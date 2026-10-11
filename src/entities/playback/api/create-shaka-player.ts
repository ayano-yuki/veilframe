import type { PlaybackPort } from '../model/playback-port';

export async function createShakaPlayer(): Promise<PlaybackPort> {
  const { default: shaka } = await import('shaka-player');
  shaka.polyfill.installAll();
  if (!shaka.Player.isBrowserSupported()) {
    throw new Error('unsupported');
  }
  const player = new shaka.Player();
  return {
    async load(video, request) {
      await player.attach(video);
      const robustness = request.mode === 'hardware' ? ['HW_SECURE_ALL'] : [];
      player.configure({
        drm: {
          servers: { 'com.widevine.alpha': request.licenseUrl },
          preferredKeySystems: ['com.widevine.alpha'],
          advanced: {
            'com.widevine.alpha': {
              videoRobustness: robustness,
              audioRobustness: robustness,
              serverCertificateUri: request.serverCertificateUrl ?? '',
            },
          },
          retryParameters: { maxAttempts: 1, timeout: 15000 },
        },
      });
      try {
        await player.load(request.manifestUrl);
      } catch (error: unknown) {
        if (
          typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code ===
            shaka.util.Error.Code.REQUESTED_KEY_SYSTEM_CONFIG_UNAVAILABLE
        ) {
          throw new Error('unsupported');
        }
        throw error;
      }
      await video.play();
    },
    async destroy() {
      await player.destroy();
    },
  };
}
