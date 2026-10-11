import type { PlaybackPort } from '../../src/entities/playback/model/playback-port';

declare global {
  interface Window {
    veilframeTestPlayback?: 'playing' | 'failed' | 'unsupported';
  }
}

export async function createShakaPlayer(): Promise<PlaybackPort> {
  if (window.veilframeTestPlayback === 'unsupported') {
    throw new Error('unsupported');
  }
  return {
    async load() {
      if (window.veilframeTestPlayback === 'failed') {
        throw new Error('test-playback-failed');
      }
    },
    async destroy() {
      /* No external resources in the UI fixture. */
    },
  };
}
