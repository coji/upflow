import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfigFn from './vite.config'

export default defineConfig(async (configEnv) =>
  mergeConfig(
    await viteConfigFn(configEnv),
    defineConfig({
      server: {
        watch: null,
      },
      test: {
        setupFiles: ['./tests/setup.ts'],
        watch: false,
        projects: [
          {
            extends: true,
            test: {
              name: 'unit',
              setupFiles: ['./tests/setup.ts'],
              exclude: [
                ...configDefaults.exclude,
                'opensrc/**',
                '.react-router/**',
                'tests/structural/**',
              ],
            },
          },
          {
            extends: true,
            test: {
              name: 'structural',
              setupFiles: ['./tests/setup.ts'],
              include: ['tests/structural/**/*.test.ts'],
              // ts-morph Project は test ファイル単位で生成されるため、
              // 複数 fork が同時に initialize すると CPU/メモリ競合で
              // 30s timeout を超える。issue #399 の supervise が
              // pnpm validate 中にここで詰まり、takt の stream idle
              // timeout で abort した。structural のみ fileParallelism を
              // 切って直列化し、それ以外のテストは並列のままにする。
              fileParallelism: false,
            },
          },
        ],
      },
    }),
  ),
)
