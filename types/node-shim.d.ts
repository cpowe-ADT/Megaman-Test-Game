type ActiveXObject = any

interface ImportMeta {
  env?: Record<string, string | undefined>
}

/** Vite's `?url` import: the URL of the emitted file (Preload fetches the dialogue lines this way). */
declare module '*?url' {
  const url: string
  export default url
}

/** Defined as `true` by `vite build` only (vite.config.ts): production fetches the dialogue lines and the enemy catalog. */
declare const __FETCH_CONTENT__: boolean | undefined
