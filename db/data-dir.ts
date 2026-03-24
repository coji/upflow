/** Resolve data directory from UPFLOW_DATA_DIR env var. Dependency-free. */
export function resolveDataDir(): string {
  const dir = process.env.UPFLOW_DATA_DIR
  if (!dir) {
    throw new Error('UPFLOW_DATA_DIR environment variable is required')
  }
  return dir
}
