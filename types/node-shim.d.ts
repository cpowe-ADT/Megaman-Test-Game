type ActiveXObject = any

interface ImportMeta {
  env?: Record<string, string | undefined>
}

/** Vite's `?url` import: the URL of the emitted file (Preload fetches the dialogue lines this way). */
declare module '*?url' {
  const url: string
  export default url
}

/** Defined as `true` by `vite build` only (vite.config.ts): production fetches the dialogue lines. */
declare const __FETCH_DIALOGUE__: boolean | undefined
