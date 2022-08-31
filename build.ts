import { build } from 'esbuild'
import { globby } from 'globby'
import esbuildPluginPino from 'esbuild-plugin-pino'

const buildMain = async () => {
  const jobs = await globby('./batch/jobs/*.ts')
  build({
    entryPoints: ['batch/index.ts', ...jobs],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    target: 'node16',
    treeShaking: true,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': "'production'"
    },
    plugins: [esbuildPluginPino({ transports: ['pino-pretty'] })]
  }).catch(() => process.exit(1))
}

buildMain()
