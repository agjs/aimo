/**
 * @file HttpPort.bun.ts
 * @layer runtime
 * @description {@link IHttpPort} backed by `fetch` (Bun/Node compatible).
 */

import type { IHttpPort } from '@core/ports/IHttpPort.types';

const DEFAULT_TIMEOUT_MS = 60_000;

function resolveTimeoutMs(envValue: string | undefined): number {
  if (envValue === undefined || envValue.length === 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(envValue, 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return parsed;
}

/**
 * HTTP JSON client for provider adapters.
 */
export class BunHttpPort implements IHttpPort {
  private readonly timeoutMs: number;

  /**
   * @param options - Optional overrides; otherwise reads `AIMO_HTTP_TIMEOUT_MS` from env (fallback 60s).
   * @param options.timeoutMs - Per-request timeout in milliseconds.
   */
  constructor(options?: { readonly timeoutMs?: number }) {
    this.timeoutMs = options?.timeoutMs ?? resolveTimeoutMs(process.env.AIMO_HTTP_TIMEOUT_MS);
  }

  /**
   * POSTs JSON and parses a JSON response body when the content-type allows it.
   * @param url - Target URL (typically HTTPS).
   * @param headers - Additional headers (adapter sets JSON content type).
   * @param jsonBody - Serializable body.
   * @returns Status code and parsed JSON, or `{ json: null }` when the body is empty.
   */
  async postJson(
    url: string,
    headers: Readonly<Record<string, string>>,
    jsonBody: unknown,
  ): Promise<{ readonly status: number; readonly json: unknown }> {
    const mergedHeaders: Record<string, string> = {
      'content-type': 'application/json',
      ...headers,
    };
    const signal = AbortSignal.timeout(this.timeoutMs);

    let response: Response;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: mergedHeaders,
        body: JSON.stringify(jsonBody),
        signal,
      });
    } catch (error: unknown) {
      if (signal.aborted) {
        return {
          status: 0,
          json: { error: { message: `request timed out after ${String(this.timeoutMs)}ms` } },
        };
      }

      const message = error instanceof Error ? error.message : String(error);
      return { status: 0, json: { error: { message } } };
    }

    const text = await response.text();

    if (text.length === 0) {
      return { status: response.status, json: null };
    }

    try {
      return { status: response.status, json: JSON.parse(text) as unknown };
    } catch {
      return { status: response.status, json: text };
    }
  }
}
