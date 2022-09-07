import { build } from 'esbuild'
import { globby } from 'globby'
import cleanPlugin from 'esbuild-plugin-clean'

const buildMain = async () => {
  const jobs = await globby('./batch/jobs/*.ts')
  build({
    entryPoints: ['batch/cli', 'batch/job-schedular.ts', ...jobs],
    bundle: true,
    metafile: true,
    outdir: 'dist',
    platform: 'node',
    target: 'node16',
    treeShaking: true,
    sourcemap: true,
    define: {
      'process.env.NODE_ENV': "'production'"
    },
    plugins: [cleanPlugin({ patterns: ['./dist/*', './dist/jobs/*'] })]
  }).catch(() => process.exit(1))
}

buildMain()
