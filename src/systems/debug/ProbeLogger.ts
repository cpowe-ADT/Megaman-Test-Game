export type ProbeLogLevel = 'info' | 'warn' | 'error'

function timestamp(): string {
  const date = new Date()
  return date.toISOString()
}

export class ProbeLogger {
  constructor(private readonly tag: string) {}

  info(message: string, context?: Record<string, unknown>): void {
    this.write('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.write('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.write('error', message, context)
  }

  private write(level: ProbeLogLevel, message: string, context?: Record<string, unknown>): void {
    const prefix = `[${this.tag}] ${timestamp()} ${level.toUpperCase()}`
    if (context) {
      // eslint-disable-next-line no-console
      console[level](`${prefix} ${message}`, context)
    } else {
      // eslint-disable-next-line no-console
      console[level](`${prefix} ${message}`)
    }
  }
}
