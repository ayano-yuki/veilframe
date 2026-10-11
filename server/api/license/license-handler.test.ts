// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEvent } from 'h3';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import handler from './[id].post';

mockNuxtImport('useRuntimeConfig', () => () => ({
  localConnectionsEnabled: false,
  connectionsJson: '[]',
}));
function event(id: string, body: Uint8Array) {
  const request = new IncomingMessage(new Socket());
  request.method = 'POST';
  request.push(body);
  request.push(null);
  const response = new ServerResponse(request);
  const created = createEvent(request, response);
  created.context.params = { id };
  return created;
}
afterEach(() => {
  vi.unstubAllGlobals();
});
describe('ライセンスAPI', () => {
  it('許可されていない接続先は外部送信せず拒否する', async () => {
    await expect(
      handler(event('unapproved', new Uint8Array([1]))),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
  it('空の要求は外部送信せず拒否する', async () => {
    await expect(
      handler(event('shaka-widevine', new Uint8Array())),
    ).rejects.toMatchObject({ statusCode: 413 });
  });
  it('バイナリ応答は保存させない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new Uint8Array([2]))),
    );
    const request = event('shaka-widevine', new Uint8Array([1]));
    expect(await handler(request)).toEqual(Buffer.from([2]));
    expect(request.node.res.getHeader('Cache-Control')).toBe('no-store');
  });
  it('上流のエラー本文・URL・秘密情報を応答へ含めない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('secret upstream URL')),
    );
    await expect(
      handler(event('shaka-widevine', new Uint8Array([1]))),
    ).rejects.toMatchObject({
      statusCode: 502,
      statusMessage: 'License request failed',
    });
  });
});
