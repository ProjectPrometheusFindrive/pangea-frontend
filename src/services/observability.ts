export interface ApiClientObservabilityEvent {
  kind: 'success' | 'error';
  method: string;
  path: string;
  status: number;
  requestId?: string;
  durationMs?: number;
}

function parseBooleanEnv(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function isObservabilityEnabled(): boolean {
  return parseBooleanEnv(import.meta.env.VITE_OBSERVABILITY_ENABLED);
}

export function emitApiClientEvent(event: ApiClientObservabilityEvent): void {
  if (!isObservabilityEnabled()) {
    return;
  }

  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  window.dispatchEvent(new CustomEvent('pangea:observability', { detail: event }));
}

