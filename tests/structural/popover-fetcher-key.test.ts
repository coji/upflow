import path from 'node:path'
import { Project, SyntaxKind } from 'ts-morph'
import { describe, expect, it } from 'vitest'

// Structural test: PRPopover and other tenant-scoped useFetcher calls must
// include `orgSlug` in their `key` so that switching org doesn't show stale
// `fetcher.data` from the previous tenant (cross-tenant leak risk).
//
// Source rule: docs/rdd/issue-314-pr-popover-resource-route.md (line 103),
// catalogued in docs/rdd/issue-336-rule-inventory.md row DG-314-POPOVER.

const ROOT = path.resolve(__dirname, '../..')

const TENANT_FETCHER_FILES = [
  // PRPopover hosts the canonical pattern.
  'app/routes/$orgSlug/+components/pr-block.tsx',
] as const

interface KeyViolation {
  file: string
  line: number
  keyText: string
}

function findUseFetcherKeyViolations(filePath: string): KeyViolation[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  })
  const sf = project.addSourceFileAtPath(path.resolve(ROOT, filePath))
  const violations: KeyViolation[] = []

  sf.forEachDescendant((node) => {
    if (node.getKind() !== SyntaxKind.CallExpression) return
    const call = node.asKindOrThrow(SyntaxKind.CallExpression)
    if (call.getExpression().getText() !== 'useFetcher') return

    const [arg] = call.getArguments()
    if (!arg || arg.getKind() !== SyntaxKind.ObjectLiteralExpression) return

    const obj = arg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
    const keyProp = obj.getProperty('key')
    if (!keyProp) return

    const keyText = keyProp.getText()
    if (!keyText.includes('orgSlug')) {
      violations.push({
        file: filePath,
        line: call.getStartLineNumber(),
        keyText,
      })
    }
  })

  return violations
}

describe('Tenant-scoped useFetcher key must include orgSlug', () => {
  for (const filePath of TENANT_FETCHER_FILES) {
    it(`${filePath}`, () => {
      const violations = findUseFetcherKeyViolations(filePath)
      expect(violations).toEqual([])
    })
  }

  it('catches a synthetic violation (sanity check on the matcher)', () => {
    // Construct a temporary source that mimics the rule violation to confirm
    // the matcher actually fires when the key is missing orgSlug.
    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      skipFileDependencyResolution: true,
    })
    const sf = project.createSourceFile(
      'synthetic.tsx',
      `
        import { useFetcher } from 'react-router'
        function X() {
          const f = useFetcher({ key: 'pr-popover:no-org-slug-here' })
          return null
        }
      `,
    )
    const violations: KeyViolation[] = []
    sf.forEachDescendant((node) => {
      if (node.getKind() !== SyntaxKind.CallExpression) return
      const call = node.asKindOrThrow(SyntaxKind.CallExpression)
      if (call.getExpression().getText() !== 'useFetcher') return
      const [arg] = call.getArguments()
      if (!arg || arg.getKind() !== SyntaxKind.ObjectLiteralExpression) return
      const obj = arg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression)
      const keyProp = obj.getProperty('key')
      if (!keyProp) return
      const keyText = keyProp.getText()
      if (!keyText.includes('orgSlug')) {
        violations.push({ file: 'synthetic.tsx', line: 0, keyText })
      }
    })
    expect(violations).toHaveLength(1)
  })
})
