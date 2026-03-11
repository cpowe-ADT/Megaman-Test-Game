import { runQueuedTests } from 'vitest'

import '../src/boss/__tests__/cooldown.spec.ts'
import '../src/boss/__tests__/pattern.spec.ts'
import '../src/boss/__tests__/attack-controller.spec.ts'
import '../src/boss/__tests__/damage-controller.spec.ts'
import '../src/boss/__tests__/state-machine.spec.ts'

runQueuedTests().catch((error) => {
  console.error(error)
  if (typeof process !== 'undefined') {
    process.exitCode = 1
  }
})
