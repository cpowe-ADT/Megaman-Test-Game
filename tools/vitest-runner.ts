import { runQueuedTests } from 'vitest'

import '../src/boss/__tests__/cooldown.spec.ts'
import '../src/boss/__tests__/pattern.spec.ts'

runQueuedTests().catch((error) => {
  console.error(error)
  if (typeof process !== 'undefined') {
    process.exitCode = 1
  }
})
