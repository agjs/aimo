/**
 * @file HttpPort.bun.ts
 * @layer runtime
 * @description {@link IHttpPort} backed by `fetch` (Bun/Node compatible).
 */

import type { IHttpPort } from '@core/ports/IHttpPort.types';

/**
 * HTTP JSON client for provider adapters.
 */
export class BunHttpPort implements IHttpPort {
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
    const response = await fetch(url, {
      method: 'POST',
      headers: mergedHeaders,
      body: JSON.stringify(jsonBody),
    });
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
