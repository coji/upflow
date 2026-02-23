// biome-ignore-all lint/suspicious/noExplicitAny: Kysely internal AST nodes are untyped
import {
  type KyselyPlugin,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
  OperationNodeTransformer,
} from 'kysely'

/**
 * Tables that have an `organization_id` column and should be automatically
 * scoped when using `orgScopedDb()`.
 *
 * NOTE: These are **snake_case** because this plugin runs AFTER CamelCasePlugin
 * has already transformed identifiers.
 */
const SCOPED_TABLES = new Set([
  'company_github_users',
  'export_settings',
  'integrations',
  'invitations',
  'members',
  'organization_settings',
  'repositories',
  'teams',
])

/**
 * Extracts the table name from an AST node that may be a TableNode or AliasNode.
 */
function extractTableName(node: any): string | undefined {
  if (!node) return undefined

  // AliasNode wraps the actual node
  if (node.kind === 'AliasNode') {
    return extractTableName(node.node)
  }

  // TableNode → SchemableIdentifierNode → IdentifierNode
  if (node.kind === 'TableNode') {
    return node.table?.identifier?.name
  }

  return undefined
}

/**
 * AST transformer that injects `WHERE organization_id = ?` into
 * SELECT, UPDATE, and DELETE queries targeting scoped tables.
 */
class OrganizationScopeTransformer extends OperationNodeTransformer {
  readonly #organizationId: string
  #depth = 0

  constructor(organizationId: string) {
    super()
    this.#organizationId = organizationId
  }

  protected override transformSelectQuery(node: any, queryId?: any): any {
    this.#depth++
    const result = super.transformSelectQuery(node, queryId)
    this.#depth--
    // Only apply to top-level queries to avoid modifying subqueries
    if (this.#depth > 0) return result
    return this.#addOrgFilterFromFrom(result)
  }

  protected override transformUpdateQuery(node: any, queryId?: any): any {
    this.#depth++
    const result = super.transformUpdateQuery(node, queryId)
    this.#depth--
    if (this.#depth > 0) return result
    return this.#addOrgFilterFromTable(result)
  }

  protected override transformDeleteQuery(node: any, queryId?: any): any {
    this.#depth++
    const result = super.transformDeleteQuery(node, queryId)
    this.#depth--
    if (this.#depth > 0) return result
    return this.#addOrgFilterFromFrom(result)
  }

  /**
   * For SELECT/DELETE: extract table from `from.froms[0]`
   */
  #addOrgFilterFromFrom(node: any): any {
    const tableName = node.from?.froms?.[0]
      ? extractTableName(node.from.froms[0])
      : undefined

    if (!tableName || !SCOPED_TABLES.has(tableName)) return node

    return { ...node, where: this.#buildWhereClause(node.where) }
  }

  /**
   * For UPDATE: extract table from `table`
   */
  #addOrgFilterFromTable(node: any): any {
    const tableName = extractTableName(node.table)
    if (!tableName || !SCOPED_TABLES.has(tableName)) return node

    return { ...node, where: this.#buildWhereClause(node.where) }
  }

  /**
   * Builds `WHERE organization_id = ?` or appends via AND.
   */
  #buildWhereClause(existingWhere: any): any {
    // BinaryOperationNode: organization_id = ?
    const condition = {
      kind: 'BinaryOperationNode' as const,
      leftOperand: {
        kind: 'ReferenceNode' as const,
        column: {
          kind: 'ColumnNode' as const,
          column: {
            kind: 'IdentifierNode' as const,
            name: 'organization_id', // snake_case (post-CamelCasePlugin)
          },
        },
      },
      operator: {
        kind: 'OperatorNode' as const,
        operator: '=' as const,
      },
      rightOperand: {
        kind: 'ValueNode' as const,
        value: this.#organizationId,
      },
    }

    if (!existingWhere) {
      return {
        kind: 'WhereNode' as const,
        where: condition,
      }
    }

    // AND with existing WHERE
    return {
      ...existingWhere,
      where: {
        kind: 'AndNode' as const,
        left: existingWhere.where,
        right: condition,
      },
    }
  }
}

/**
 * Kysely plugin that automatically adds `WHERE organization_id = ?`
 * to all SELECT/UPDATE/DELETE queries on org-scoped tables.
 *
 * Usage:
 * ```ts
 * const scopedDb = db.withPlugin(new OrganizationScopePlugin(organization.id))
 * // All queries now scoped to this organization
 * ```
 */
export class OrganizationScopePlugin implements KyselyPlugin {
  readonly #transformer: OrganizationScopeTransformer

  constructor(organizationId: string) {
    this.#transformer = new OrganizationScopeTransformer(organizationId)
  }

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    return this.#transformer.transformNode(args.node)
  }

  async transformResult(
    args: PluginTransformResultArgs,
  ): Promise<QueryResult<UnknownRow>> {
    return await args.result
  }
}
