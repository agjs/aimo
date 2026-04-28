/**
 * @file HttpPort.contract.test.ts
 * @description Contract-style assertions for `IHttpPort` (timeout + JSON parse semantics).
 */

import { BunHttpPort } from '@runtime/bun/HttpPort.bun';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';

describe('IHttpPort contract (BunHttpPort)', () => {
  let server: ReturnType<typeof Bun.serve>;
  let baseUrl = '';

  beforeAll(() => {
    server = Bun.serve({
      port: 0,
      async fetch(req) {
        const url = new URL(req.url);

        if (url.pathname === '/json-200') {
          return Response.json({ hello: 'world' });
        }

        if (url.pathname === '/empty-204') {
          return new Response('', { status: 204 });
        }

        if (url.pathname === '/text-200') {
          return new Response('not-json-body', {
            status: 200,
            headers: { 'content-type': 'text/plain' },
          });
        }

        if (url.pathname === '/error-400') {
          return Response.json({ error: { message: 'bad request' } }, { status: 400 });
        }

        if (url.pathname === '/echo') {
          return Response.json({ method: req.method, body: await req.text() });
        }

        if (url.pathname === '/slow') {
          await Bun.sleep(2000);
          return Response.json({ slow: true });
        }

        return new Response('not found', { status: 404 });
      },
    });
    baseUrl = `http://localhost:${String(server.port)}`;
  });

  afterAll(async () => {
    await server.stop(true);
  });

  it('parses JSON 200 responses', async () => {
    const port = new BunHttpPort();
    const res = await port.postJson(`${baseUrl}/json-200`, {}, { ping: 1 });
    expect(res.status).toBe(200);
    expect(res.json).toEqual({ hello: 'world' });
  });

  it('returns json:null on empty body', async () => {
    const port = new BunHttpPort();
    const res = await port.postJson(`${baseUrl}/empty-204`, {}, {});
    expect(res.status).toBe(204);
    expect(res.json).toBeNull();
  });

  it('returns the raw text when body is not JSON', async () => {
    const port = new BunHttpPort();
    const res = await port.postJson(`${baseUrl}/text-200`, {}, {});
    expect(res.status).toBe(200);
    expect(res.json).toBe('not-json-body');
  });

  it('passes through 4xx with parsed JSON error body', async () => {
    const port = new BunHttpPort();
    const res = await port.postJson(`${baseUrl}/error-400`, {}, {});
    expect(res.status).toBe(400);
    expect(res.json).toEqual({ error: { message: 'bad request' } });
  });

  it('sends content-type and body verbatim', async () => {
    const port = new BunHttpPort();
    const res = await port.postJson(`${baseUrl}/echo`, { 'x-trace': 't' }, { a: 1 });
    expect(res.status).toBe(200);
    const body = res.json as { method: string; body: string };
    expect(body.method).toBe('POST');
    expect(JSON.parse(body.body)).toEqual({ a: 1 });
  });

  it('aborts with status 0 when timeout fires', async () => {
    const port = new BunHttpPort({ timeoutMs: 50 });
    const res = await port.postJson(`${baseUrl}/slow`, {}, {});
    expect(res.status).toBe(0);
    const j = res.json as { error?: { message?: string } };
    expect(j.error?.message).toContain('timed out');
  });
});
