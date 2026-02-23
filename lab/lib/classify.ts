import type { PRSizeInfo } from './github'

export type PRSize = 'XS' | 'S' | 'M' | 'L' | 'XL'

export function classifyPR(pr: PRSizeInfo): PRSize {
  const additions = pr.additions ?? 0
  const deletions = pr.deletions ?? 0
  const totalLines = additions + deletions
  const changedFiles = pr.changedFiles ?? 0
  const files = pr.files?.nodes ?? []
  const title = (pr.title ?? '').toLowerCase()
  const labels = (pr.labels?.nodes ?? []).map((l) => l.name.toLowerCase())

  // Check file paths for risk indicators
  let hasDBChange = false
  let hasAPIChange = false
  let hasAuthChange = false
  let hasPaymentChange = false
  let hasTestOnly = true
  let hasDocsOnly = true
  let hasDepsChange = false
  const componentDirs = new Set<string>()

  for (const f of files) {
    const p = f.path.toLowerCase()

    // Track unique component directories (2 levels deep)
    const parts = p.split('/')
    if (parts.length >= 2) componentDirs.add(parts.slice(0, 2).join('/'))

    // Risk indicators
    if (p.includes('migration') || p.includes('schema') || p.includes('.sql'))
      hasDBChange = true
    if (
      p.includes('/api/') ||
      p.includes('route') ||
      p.includes('endpoint') ||
      p.includes('controller')
    )
      hasAPIChange = true
    if (
      p.includes('auth') ||
      p.includes('session') ||
      p.includes('permission') ||
      p.includes('token')
    )
      hasAuthChange = true
    if (
      p.includes('payment') ||
      p.includes('billing') ||
      p.includes('charge') ||
      p.includes('stripe')
    )
      hasPaymentChange = true
    if (
      p.includes('package.json') ||
      p.includes('lock') ||
      p.includes('gemfile') ||
      p.includes('go.sum') ||
      p.includes('go.mod')
    )
      hasDepsChange = true

    // Test/docs only check
    if (!p.includes('test') && !p.includes('spec') && !p.includes('__test'))
      hasTestOnly = false
    if (
      !p.includes('readme') &&
      !p.includes('.md') &&
      !p.includes('doc') &&
      !p.includes('changelog')
    )
      hasDocsOnly = false
  }

  // Title-based indicators
  const isTitleTypo = /typo|fix typo|spelling|誤字/.test(title)
  const isTitleFormat = /format|lint|prettier|rubocop|eslint|フォーマット/.test(
    title,
  )
  const isTitleDeps = /bump|update|upgrade|dependabot|renovate|version/.test(
    title,
  )
  const isTitleDocs = /docs|readme|comment|コメント/.test(title)
  const isTitleRefactor = /refactor|rename|リファクタ/.test(title)

  // Label-based
  const hasDepsLabel = labels.some(
    (l) => l.includes('dependencies') || l.includes('dep'),
  )

  // === Classification logic ===

  // XS: Trivial, no risk
  if (
    totalLines <= 10 &&
    changedFiles <= 3 &&
    !hasDBChange &&
    !hasAPIChange &&
    !hasAuthChange &&
    !hasPaymentChange
  ) {
    return 'XS'
  }
  if (isTitleTypo || isTitleFormat) return 'XS'
  if (hasDocsOnly && totalLines <= 50) return 'XS'
  if (
    hasDepsChange &&
    changedFiles <= 2 &&
    !hasDBChange &&
    (isTitleDeps || hasDepsLabel)
  )
    return 'XS'

  // S: Low risk, narrow scope
  if (hasTestOnly) return 'S'
  if (
    totalLines <= 30 &&
    changedFiles <= 5 &&
    !hasDBChange &&
    !hasAPIChange &&
    !hasAuthChange &&
    !hasPaymentChange
  )
    return 'S'
  if (isTitleDocs && totalLines <= 100) return 'S'
  if (isTitleRefactor && totalLines <= 50 && changedFiles <= 5) return 'S'

  // XL: System-wide (check before L to avoid shadowing)
  if (totalLines > 1000 && changedFiles > 30) return 'XL'
  if (hasDBChange && hasAPIChange && hasAuthChange) return 'XL'
  if (componentDirs.size > 10) return 'XL'

  // L: Wide impact or critical domain
  if (hasPaymentChange || hasAuthChange) return 'L'
  if (hasDBChange && hasAPIChange) return 'L'
  if (totalLines > 500 && changedFiles > 15) return 'L'

  // M: Default moderate
  return 'M'
}
