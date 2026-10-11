import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createShakaPlayer } from './create-shaka-player';

const mocks = vi.hoisted(() => ({
  install: vi.fn(),
  supported: vi.fn(),
  attach: vi.fn(),
  configure: vi.fn(),
  load: vi.fn(),
  destroy: vi.fn(),
  drmInfo: vi.fn(),
  networking: vi.fn(),
  register: vi.fn(),
}));
vi.mock('shaka-player', () => {
  class Player {
    static isBrowserSupported = mocks.supported;
    attach = mocks.attach;
    configure = mocks.configure;
    load = mocks.load;
    destroy = mocks.destroy;
    drmInfo = mocks.drmInfo;
    getNetworkingEngine = mocks.networking;
  }
  return {
    default: {
      polyfill: { installAll: mocks.install },
      Player,
      net: { NetworkingEngine: { RequestType: { LICENSE: 2 } } },
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
  mocks.drmInfo.mockReturnValue({ keySystem: 'com.widevine.alpha' });
  mocks.networking.mockReturnValue({ registerRequestFilter: mocks.register });
});
describe('Shakaアダプター', () => {
  it.each(['normal', 'hardware'] as const)(
    'PlayReadyの方式を固定し、音声のハードウェア保護を要求しない %s',
    async (mode) => {
      const keySystem =
        mode === 'hardware'
          ? 'com.microsoft.playready.recommendation.3000'
          : 'com.microsoft.playready.recommendation';
      mocks.drmInfo.mockReturnValue({ keySystem });
      const adapter = await createShakaPlayer();
      const video = document.createElement('video');
      const play = vi.spyOn(video, 'play').mockResolvedValue();
      await adapter.load(video, {
        drm: 'playready',
        mode,
        manifestUrl: 'https://example.test/playready.mpd',
        licenseUrl: '/api/license/playready',
        serverCertificateUrl: 'https://example.test/widevine-cert',
      });
      expect(mocks.configure).toHaveBeenCalledWith({
        drm: {
          servers: {
            [keySystem]: '/api/license/playready',
            'com.microsoft.playready': '/api/license/playready',
          },
          preferredKeySystems: [keySystem],
          keySystemsMapping: { 'com.microsoft.playready': keySystem },
          advanced: {
            [keySystem]: {
              videoRobustness: [],
              audioRobustness: [],
              serverCertificateUri: '',
            },
          },
          retryParameters: { maxAttempts: 1, timeout: 15000 },
        },
      });
      expect(play).toHaveBeenCalledOnce();
      await adapter.destroy();
    },
  );
  it('ライセンスだけを選択したNuxt接続先へ送り、他方式の要求を拒否する', async () => {
    const adapter = await createShakaPlayer();
    const video = document.createElement('video');
    vi.spyOn(video, 'play').mockResolvedValue();
    await adapter.load(video, {
      mode: 'normal',
      manifestUrl: 'https://example.test/video',
      licenseUrl: '/api/license/test',
    });
    const filter = mocks.register.mock.calls[0]![0] as (
      type: number,
      message: { uris: string[]; drmInfo?: { keySystem: string } | null },
    ) => void;
    const certificate = { uris: ['https://example.test/certificate'] };
    filter(1, certificate);
    expect(certificate.uris).toEqual(['https://example.test/certificate']);
    const license: { uris: string[]; drmInfo: { keySystem: string } | null } = {
      uris: ['https://example.test/embedded-license'],
      drmInfo: { keySystem: 'com.widevine.alpha' },
    };
    mocks.drmInfo.mockReturnValue(null);
    filter(2, license);
    expect(license.uris).toEqual([
      new URL('/api/license/test', window.location.href).href,
    ]);
    for (const info of [
      null,
      { keySystem: 'com.microsoft.playready.recommendation' },
    ]) {
      license.drmInfo = info;
      expect(() => filter(2, license)).toThrow('unsupported');
    }
    await adapter.destroy();
  });
  it('通信エンジンがない場合に停止する', async () => {
    mocks.networking.mockReturnValue(null);
    const adapter = await createShakaPlayer();
    await expect(
      adapter.load(document.createElement('video'), {
        mode: 'normal',
        manifestUrl: 'https://example.test/video',
        licenseUrl: '/api/license/test',
      }),
    ).rejects.toThrow('unsupported');
    await adapter.destroy();
  });
  it.each([null, { keySystem: 'org.w3.clearkey' }])(
    '選択外の方式やDRMなしで成功扱いにしない %s',
    async (info) => {
      mocks.drmInfo.mockReturnValue(info);
      const adapter = await createShakaPlayer();
      const video = document.createElement('video');
      const play = vi.spyOn(video, 'play').mockResolvedValue();
      await expect(
        adapter.load(video, {
          mode: 'hardware',
          manifestUrl: 'https://example.test/video',
          licenseUrl: '/api/license/test',
        }),
      ).rejects.toThrow('unsupported');
      expect(play).not.toHaveBeenCalled();
      await adapter.destroy();
    },
  );
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
