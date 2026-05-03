// dependency-cruiser config — mechanizes (a) machine-checkable rules from
// docs/rdd/issue-336-rule-inventory.md that are best expressed as import
// constraints. Add new forbidden / allowed rules here as more inventory items
// get mechanized.

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
        'middleware, and other `.server.ts` files are free to import them. ' +
        'Inventory: Medium #6.',
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
    {
      name: 'no-direct-octokit-construction',
      severity: 'error',
      comment:
        'Only the Octokit gatekeeper module may import `Octokit` as a value ' +
        'from the `octokit` package. Every other call site must go through ' +
        '`resolveOctokitForRepository` / `resolveOctokitForInstallation` / ' +
        '`createOctokit` from `app/services/github-octokit.server.ts`. ' +
        'This is what makes the "repository に紐づく GitHub API 呼び出しは ' +
        '`githubInstallationId` を select 済みでなければ作れない" invariant ' +
        'load-bearing — `resolveOctokitForRepository` requires a row that ' +
        'already has `githubInstallationId` in its type, so direct ' +
        '`new Octokit()` is the only way to bypass that check. Type-only ' +
        'imports (`import type { Octokit }`) are fine — the type is erased ' +
        'at compile time and constructs nothing. Inventory: Medium #11.',
      from: {
        path: '^(app|batch)/',
        pathNot: '^app/services/github-octokit\\.server\\.ts$',
      },
      to: {
        // `to.path` matches against the resolved path, not the import
        // specifier. With pnpm the resolved path looks like
        // `node_modules/.pnpm/octokit@5.0.5/node_modules/octokit/dist-types/...`.
        // Both pnpm and a flat `node_modules/` layout share the
        // `/node_modules/octokit/` segment, so anchor on that.
        path: '/node_modules/octokit/',
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
      // Skip generated / vendored code and test files. Note we *don't*
      // exclude `node_modules` here — `doNotFollow` already stops the crawl
      // from descending into them, but we still need the import edges to
      // external packages to appear in the graph so rules like
      // `no-direct-octokit-construction` (which check `to.path: '^octokit$'`)
      // can fire.
      path: '(^|/)\\.(react-router|takt|takt-worktrees)|^opensrc/|^build/|\\.test\\.|\\.spec\\.',
    },
  },
}
