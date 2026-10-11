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
      const playready = request.drm === 'playready';
      const keySystem = playready
        ? request.mode === 'hardware'
          ? 'com.microsoft.playready.recommendation.3000'
          : 'com.microsoft.playready.recommendation'
        : 'com.widevine.alpha';
      const robustness = request.mode === 'hardware' ? ['HW_SECURE_ALL'] : [];
      const networking = player.getNetworkingEngine();
      if (!networking) {
        throw new Error('unsupported');
      }
      networking.registerRequestFilter((type, message) => {
        if (type === shaka.net.NetworkingEngine.RequestType.LICENSE) {
          if (message.drmInfo?.keySystem !== keySystem) {
            throw new Error('unsupported');
          }
          message.uris = [
            new URL(request.licenseUrl, window.location.href).href,
          ];
        }
      });
      player.configure({
        drm: {
          servers: {
            [keySystem]: request.licenseUrl,
            ...(playready
              ? { 'com.microsoft.playready': request.licenseUrl }
              : {}),
          },
          preferredKeySystems: [keySystem],
          keySystemsMapping: playready
            ? { 'com.microsoft.playready': keySystem }
            : {},
          advanced: {
            [keySystem]: {
              videoRobustness: playready ? [] : robustness,
              audioRobustness: playready ? [] : robustness,
              serverCertificateUri: playready
                ? ''
                : (request.serverCertificateUrl ?? ''),
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
      if (player.drmInfo()?.keySystem !== keySystem) {
        throw new Error('unsupported');
      }
      await video.play();
    },
    async destroy() {
      await player.destroy();
    },
  };
}
