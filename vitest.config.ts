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
        exclude: [...configDefaults.exclude, 'opensrc/**', '.react-router/**'],
        watch: false,
      },
    }),
  ),
)
