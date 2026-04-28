/**
 * @file IHttpPort.types.ts
 * @layer core
 * @description Minimal HTTP POST(JSON) port for OpenAI-compatible providers (implemented in `runtime/bun`).
 */

/**
 * JSON POST with typed status + parsed JSON body (adapters may throw on non-JSON bodies).
 */
export interface IHttpPort {
  /**
   * POSTs a JSON body and parses a JSON response when possible.
   * @param url - Fully qualified HTTPS URL.
   * @param headers - Extra headers merged with `Content-Type: application/json` in the adapter.
   * @param jsonBody - Serializable JSON value.
   * @returns HTTP status and parsed JSON (or adapter-defined shape on parse failure).
   */
  postJson(
    url: string,
    headers: Readonly<Record<string, string>>,
    jsonBody: unknown,
  ): Promise<{ readonly status: number; readonly json: unknown }>;
}
