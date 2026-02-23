import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfigFn from './vite.config'

export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfigFn(configEnv),
    defineConfig({
      test: {
        exclude: [...configDefaults.exclude, 'opensrc/**'],
      },
    }),
  ),
)
