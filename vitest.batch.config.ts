import vitestConfig from './vitest.config'

export default {
  ...vitestConfig,
  test: {
    globals: true,
    environment: 'vprisma',
    setupFiles: ['vitest-environment-vprisma/setup', './test/vitest.batch.setup.ts'],
    include: ['batch/**/*.test.ts'],
  },
} as typeof vitestConfig
