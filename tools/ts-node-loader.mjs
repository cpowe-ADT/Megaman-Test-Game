import { readFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ts from 'typescript'

export async function resolve(specifier, context, defaultResolve) {
  const parentURL = context.parentURL ?? pathToFileURL(`${process.cwd()}/`).href

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

    const candidateUrl = new URL(`${specifier}.ts`, parentURL)
    try {
      await access(fileURLToPath(candidateUrl))
      return { url: candidateUrl.href, shortCircuit: true }
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
