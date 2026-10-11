import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createShakaPlayer } from './create-shaka-player';

const mocks = vi.hoisted(() => ({
  install: vi.fn(),
  supported: vi.fn(),
  attach: vi.fn(),
  configure: vi.fn(),
  load: vi.fn(),
  destroy: vi.fn(),
}));
vi.mock('shaka-player', () => {
  class Player {
    static isBrowserSupported = mocks.supported;
    attach = mocks.attach;
    configure = mocks.configure;
    load = mocks.load;
    destroy = mocks.destroy;
  }
  return {
    default: {
      polyfill: { installAll: mocks.install },
      Player,
      util: {
        Error: { Code: { REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE: 6001 } },
      },
    },
  };
});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.supported.mockReturnValue(true);
  mocks.load.mockResolvedValue(undefined);
});
describe('Shakaアダプター', () => {
  it.each(['normal', 'hardware'] as const)(
    '要求保護モードを緩和せず設定する %s',
    async (mode) => {
      const adapter = await createShakaPlayer();
      const video = document.createElement('video');
      const play = vi.spyOn(video, 'play').mockResolvedValue();
      await adapter.load(video, {
        manifestUrl: 'https://example.test/video',
        licenseUrl: '/api/license/test',
        mode,
        serverCertificateUrl:
          mode === 'hardware' ? 'https://example.test/certificate' : undefined,
      });
      const expected = mode === 'hardware' ? ['HW_SECURE_ALL'] : [];
      expect(mocks.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          drm: expect.objectContaining({
            advanced: {
              'com.widevine.alpha': {
                videoRobustness: expected,
                audioRobustness: expected,
                serverCertificateUri:
                  mode === 'hardware' ? 'https://example.test/certificate' : '',
              },
            },
            retryParameters: { maxAttempts: 1, timeout: 15000 },
          }),
        }),
      );
      expect(play).toHaveBeenCalledOnce();
      await adapter.destroy();
      expect(mocks.destroy).toHaveBeenCalledOnce();
    },
  );
  it('非対応を通知する', async () => {
    mocks.supported.mockReturnValue(false);
    await expect(createShakaPlayer()).rejects.toThrow('unsupported');
  });
  it.each([null, 'failure', {}, { code: 1001 }, { code: 6001 }])(
    'DRMの保護要件非対応を分類する %s',
    async (failure) => {
      mocks.load.mockRejectedValue(failure);
      const adapter = await createShakaPlayer();
      const result = adapter.load(document.createElement('video'), {
        manifestUrl: 'https://example.test/video',
        licenseUrl: '/api/license/test',
        mode: 'hardware',
      });
      if (
        failure &&
        typeof failure === 'object' &&
        'code' in failure &&
        failure.code === 6001
      ) {
        await expect(result).rejects.toThrow('unsupported');
      } else {
        await expect(result).rejects.toBe(failure);
      }
      await adapter.destroy();
    },
  );
});
