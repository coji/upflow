import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '../../..')

function resolveCandidate(base) {
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.mjs`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.mjs'),
    base,
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
  }

  return null
}

function resolveProjectPath(specifier) {
  return resolveCandidate(path.join(projectRoot, specifier.slice(2)))
}

function resolveLocalPath(specifier, parentURL) {
  const parentPath = parentURL.startsWith('file:')
    ? fileURLToPath(parentURL)
    : parentURL
  const base = specifier.startsWith('/')
    ? specifier
    : path.resolve(path.dirname(parentPath), specifier)

  return resolveCandidate(base)
}

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('~/')) {
    const resolved = resolveProjectPath(specifier)
    if (!resolved) {
      throw new Error(`Unable to resolve alias import: ${specifier}`)
    }
    return nextResolve(pathToFileURL(resolved).href, context)
  }

  if (
    (specifier.startsWith('./') ||
      specifier.startsWith('../') ||
      specifier.startsWith('/')) &&
    context.parentURL
  ) {
    const resolved = resolveLocalPath(specifier, context.parentURL)
    if (resolved) {
      return nextResolve(pathToFileURL(resolved).href, context)
    }
  }

  return nextResolve(specifier, context)
}
