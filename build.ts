import { build } from 'esbuild'
import { globby } from 'globby'

const buildMain = async () => {
  const jobs = await globby('./batch/jobs/*.ts')
  build({
    entryPoints: ['batch/index.ts', ...jobs],
    bundle: true,
    outdir: 'dist',
    platform: 'node',
    target: 'node16',
    treeShaking: true,
    define: {
      'process.env.NODE_ENV': "'production'"
    }
  }).catch(() => process.exit(1))
}

buildMain()
