type TestFn = () => void | Promise<void>

interface TestCase {
  name: string
  fn: TestFn
  suite: string[]
}

const cases: TestCase[] = []
const suiteStack: string[] = []

export function describe(name: string, fn: () => void): void {
  suiteStack.push(name)
  try {
    fn()
  } finally {
    suiteStack.pop()
  }
}

export function it(name: string, fn: TestFn): void {
  cases.push({ name, fn, suite: [...suiteStack] })
}

export const test = it

interface Matcher<T> {
  toBe(expected: T): void
  toEqual(expected: T): void
  toBeTruthy(): void
  toBeFalsy(): void
}

class AssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssertionError'
  }
}

export function expect<T>(received: T): Matcher<T> {
  return {
    toBe(expected: T) {
      if (received !== expected) {
        throw new AssertionError(`Expected ${JSON.stringify(received)} to be ${JSON.stringify(expected)}`)
      }
    },
    toEqual(expected: T) {
      const a = JSON.stringify(received)
      const b = JSON.stringify(expected)
      if (a !== b) {
        throw new AssertionError(`Expected ${a} to deeply equal ${b}`)
      }
    },
    toBeTruthy() {
      if (!received) {
        throw new AssertionError('Expected value to be truthy')
      }
    },
    toBeFalsy() {
      if (received) {
        throw new AssertionError('Expected value to be falsy')
      }
    }
  }
}

export async function runQueuedTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0
  let failed = 0
  for (const testCase of cases) {
    const label = [...testCase.suite, testCase.name].join(' › ')
    try {
      await testCase.fn()
      console.log(`✓ ${label}`)
      passed += 1
    } catch (error) {
      failed += 1
      console.error(`✗ ${label}`)
      console.error(error)
    }
  }
  console.log(`\nTest summary: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    throw new Error(`Test failures: ${failed}`)
  }
  return { passed, failed }
}
