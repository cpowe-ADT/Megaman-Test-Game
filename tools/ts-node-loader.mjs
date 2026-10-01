import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export async function resolve(specifier, context, defaultResolve) {
  const parentURL = context.parentURL ?? pathToFileURL(`${process.cwd()}/`).href

  if (specifier === 'vitest') {
    const shimUrl = new URL('./tools/vitest-shim.ts', pathToFileURL(`${process.cwd()}/`).href)
    return { url: shimUrl.href, shortCircuit: true }
  }

  if (specifier.endsWith('.ts')) {
    const resolvedUrl = new URL(specifier, parentURL)
    return { url: resolvedUrl.href, shortCircuit: true }
  }

  try {
    return await defaultResolve(specifier, context, defaultResolve)
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('file:')) {
      throw error
    }

    if (path.extname(specifier)) {
      throw error
    }

    const fileCandidateUrl = new URL(`${specifier}.ts`, parentURL)
    try {
      await access(fileURLToPath(fileCandidateUrl))
      return { url: fileCandidateUrl.href, shortCircuit: true }
    } catch {
      // fall through to the directory-index candidate below
    }

    const indexCandidateUrl = new URL(`${specifier}/index.ts`, parentURL)
    try {
      await access(fileURLToPath(indexCandidateUrl))
      return { url: indexCandidateUrl.href, shortCircuit: true }
    } catch {
      throw error
    }
  }
}

export async function load(url, context, defaultLoad) {
  if (!url.endsWith('.ts')) {
    return defaultLoad(url, context, defaultLoad)
  }

  const filename = fileURLToPath(url)
  const source = await readFile(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
      sourceMap: false
    }
  })

  return {
    format: 'module',
    source: outputText,
    shortCircuit: true
  }
}
