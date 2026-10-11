// @vitest-environment happy-dom
import { mockNuxtImport } from '@nuxt/test-utils/runtime';
import { describe, expect, it, vi } from 'vitest';
import handler from './connections.get';
import type { H3Event } from 'h3';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

const config = vi.hoisted(() => ({
  localConnectionsEnabled: false as boolean | string,
  connectionsJson: '[]',
  defaultManifestUrl: 'https://example.test/local?token=private',
  defaultConnectionId: 'custom',
}));
function event(): H3Event {
  const req = new IncomingMessage(new Socket());
  return { node: { req, res: new ServerResponse(req) } } as H3Event;
}
mockNuxtImport('useRuntimeConfig', () => () => config);
describe('接続先API', () => {
  it('公開情報にはURLと認証ヘッダーを返さない', async () => {
    vi.stubEnv('VERCEL', '');
    config.localConnectionsEnabled = true;
    config.connectionsJson = JSON.stringify([
      {
        id: 'custom',
        name: '独自接続',
        url: 'https://example.test/private',
        headers: { Authorization: 'secret' },
      },
    ]);
    const result = await handler(event());
    expect(result).toEqual({
      localEnabled: true,
      connections: [
        { id: 'shaka-widevine', name: 'Shaka 公開テスト', drm: 'widevine' },
        {
          id: 'microsoft-playready',
          name: 'Microsoft PlayReady 公開テスト',
          drm: 'playready',
        },
        { id: 'custom', name: '独自接続', drm: 'widevine' },
      ],
      defaults: {
        manifestUrl: config.defaultManifestUrl,
        connectionId: 'custom',
      },
    });
  });
  it.each([false, 'false', 'true'])(
    'Vercelでは独自接続を拒否する %s',
    async (enabled) => {
      vi.stubEnv('VERCEL', '1');
      config.localConnectionsEnabled = enabled;
      expect(await handler(event())).toEqual({
        localEnabled: false,
        connections: [
          { id: 'shaka-widevine', name: 'Shaka 公開テスト', drm: 'widevine' },
          {
            id: 'microsoft-playready',
            name: 'Microsoft PlayReady 公開テスト',
            drm: 'playready',
          },
        ],
      });
      vi.unstubAllEnvs();
    },
  );
  it.each([false, 'true', 'false'])(
    'ローカルでフラグを解釈する %s',
    async (enabled) => {
      vi.stubEnv('VERCEL', '');
      config.localConnectionsEnabled = enabled;
      config.connectionsJson = '[]';
      expect((await handler(event())).localEnabled).toBe(enabled === 'true');
      vi.unstubAllEnvs();
    },
  );
});
