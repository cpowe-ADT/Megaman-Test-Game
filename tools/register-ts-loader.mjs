// Registers tools/ts-node-loader.mjs through the stable `node:module` API instead of the deprecated
// `--loader` CLI flag, so `node --import ./tools/register-ts-loader.mjs ...` prints no ExperimentalWarning.
import { register } from 'node:module'

register('./ts-node-loader.mjs', import.meta.url)
