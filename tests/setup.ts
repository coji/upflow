// Extends vitest's `expect` with @testing-library/jest-dom matchers
// (`toBeInTheDocument`, `toHaveClass`, `toHaveAttribute`, ...). Without
// this, tests that use those matchers fail with "expect(...).toBeInTheDocument
// is not a function" — the failure mode that bit cursor's test-fix loop on
// issue #399. Loaded via `setupFiles` in vitest.config.ts so every test file
// gets the matchers without having to import them locally.
import '@testing-library/jest-dom/vitest'
