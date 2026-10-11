import type {
  PlaybackPort,
  PlaybackRequest,
  PlaybackState,
} from '@fsd/entities/playback/model/playback-port';

export function createPlaybackController(
  factory: () => Promise<PlaybackPort>,
  update: (state: PlaybackState) => void,
) {
  let revision = 0;
  let active: PlaybackPort | undefined;
  return {
    async start(video: HTMLVideoElement, request: PlaybackRequest) {
      const current = ++revision;
      const previous = active;
      active = undefined;
      update('loading');
      let player: PlaybackPort | undefined;
      try {
        await previous?.destroy();
        if (current !== revision) {
          return;
        }
        player = await factory();
        if (current !== revision) {
          await player.destroy();
          return;
        }
        active = player;
        await player.load(video, request);
        if (current === revision) {
          update('playing');
        }
      } catch (error: unknown) {
        if (current === revision) {
          active = undefined;
          await player?.destroy().catch(() => undefined);
          update(
            error instanceof Error && error.message === 'unsupported'
              ? 'unsupported'
              : 'failed',
          );
        }
      }
    },
    async reset() {
      revision++;
      const previous = active;
      active = undefined;
      update('idle');
      await previous?.destroy();
    },
  };
}
