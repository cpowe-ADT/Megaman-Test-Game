declare module 'vitest' {
  export type TestFn = () => void | Promise<void>
  export function describe(name: string, fn: () => void): void
  export function it(name: string, fn: TestFn): void
  export const test: typeof it
  export interface Matcher<T> {
    toBe(expected: T): void
    toEqual(expected: T): void
    toBeTruthy(): void
    toBeFalsy(): void
  }
  export function expect<T>(received: T): Matcher<T>
  export function runQueuedTests(): Promise<{ passed: number; failed: number }>
}
