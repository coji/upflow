// dependency-cruiser config — currently scoped to the `.server.ts` isolation
// rule. Catalogued in docs/rdd/issue-336-rule-inventory.md as the Medium #6
// item ("`.server.ts` はサーバ専用。クライアント束から参照しない").
//
// Add new forbidden / allowed rules to this file as more (a) machine-checkable
// items in the inventory get mechanized.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-server-from-client-module',
      severity: 'error',
      comment:
        '`.server.ts` modules must not be imported from client-loaded code. ' +
        'Client modules live under app/components, app/hooks, app/types, ' +
        'or are non-server files in app/libs / app/services. Routes, ' +
        'middleware, and other `.server.ts` files are free to import them.',
      from: {
        path: '^app/(components|hooks|types|libs|services)/',
        pathNot: '\\.server\\.tsx?$|\\.test\\.tsx?$|\\.spec\\.tsx?$',
      },
      to: {
        path: '\\.server\\.tsx?$',
        // Type-only imports are erased at compile time and never reach the
        // client bundle, so they're safe. Cover both forms:
        //   - `import type { X } from 'mod'`            -> `type-only`
        //   - `const x: import('mod').T` (annotation)   -> `type-import`
        dependencyTypesNot: ['type-only', 'type-import'],
      },
    },
  ],
  options: {
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
    doNotFollow: {
      path: 'node_modules',
    },
    exclude: {
      path: '(^|/)\\.(react-router|takt|takt-worktrees)|^opensrc/|^build/|node_modules|\\.test\\.|\\.spec\\.',
    },
  },
}
