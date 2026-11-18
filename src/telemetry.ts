// No-op telemetry for self-hosted deployments (avoids sending events to Mem0 Cloud PostHog).

export function captureEvent(
  _eventName: string,
  _properties: Record<string, unknown> = {},
  _context?: { apiKey?: string },
): void {}

export function captureToolEvent(
  _action: string,
  _properties: Record<string, unknown> = {},
  _context?: { apiKey?: string },
): void {}

export function captureCommandEvent(
  _command: string,
  _properties: Record<string, unknown> = {},
  _context?: { apiKey?: string },
): void {}

export function _getEventQueue(): Record<string, unknown>[] {
  return [];
}

export function _resetForTesting(): void {}
