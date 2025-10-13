const search = typeof window !== 'undefined' ? window.location.search : ''
const params = search ? new URLSearchParams(search) : undefined

const flagFromQuery = params?.get('diag') === '1'
const flagFromEnv = import.meta.env?.VITE_DIAG === '1'

export const DIAGNOSTICS_ENABLED = !!(flagFromQuery || flagFromEnv)
