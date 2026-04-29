/**
 * Canonical "repo#number" identifier for a pull request, used in tables,
 * tooltips, and ARIA labels.
 */
export function formatPrIdentifier(repo: string, number: number): string {
  return `${repo}#${number}`
}
