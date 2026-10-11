import { describe, expect, it, vi } from 'vitest';
import type {
  PlaybackPort,
  PlaybackRequest,
} from '@fsd/entities/playback/model/playback-port';
import { createPlaybackController } from './create-playback-controller';

const request: PlaybackRequest = {
  manifestUrl: 'https://example.test/video',
  licenseUrl: '/api/license/test',
  mode: 'normal',
};
const video = document.createElement('video');
function player(): PlaybackPort {
  return {
    load: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

describe('再生の操作と競合', () => {
  it('再生後の切り替えと終了でプレイヤーを破棄する', async () => {
    const adapter = player();
    const update = vi.fn();
    const controller = createPlaybackController(async () => adapter, update);
    await controller.start(video, request);
    await controller.start(video, request);
    await controller.reset();
    await controller.reset();
    expect(adapter.load).toHaveBeenCalledWith(video, request);
    expect(adapter.destroy).toHaveBeenCalledTimes(2);
    expect(update.mock.calls.map(([state]) => state)).toEqual([
      'loading',
      'playing',
      'loading',
      'playing',
      'idle',
      'idle',
    ]);
  });
  it.each([new Error('unsupported'), new Error('load-failed'), 'failure'])(
    '失敗を安全な状態に変換する %s',
    async (error) => {
      const update = vi.fn();
      const controller = createPlaybackController(async () => {
        throw error;
      }, update);
      await controller.start(video, request);
      expect(update).toHaveBeenLastCalledWith(
        error instanceof Error && error.message === 'unsupported'
          ? 'unsupported'
          : 'failed',
      );
    },
  );
  it('load失敗後は破棄が失敗しても結果を通知する', async () => {
    const adapter = player();
    vi.mocked(adapter.load).mockRejectedValue(new Error('license-failed'));
    vi.mocked(adapter.destroy).mockRejectedValue(new Error('destroy-failed'));
    const update = vi.fn();
    await createPlaybackController(async () => adapter, update).start(
      video,
      request,
    );
    expect(update).toHaveBeenLastCalledWith('failed');
    expect(adapter.destroy).toHaveBeenCalledOnce();
  });
  it('生成中に条件を変えたら遅れて生成されたプレイヤーを破棄する', async () => {
    const pending = deferred<PlaybackPort>();
    const adapter = player();
    const update = vi.fn();
    const controller = createPlaybackController(() => pending.promise, update);
    const running = controller.start(video, request);
    await Promise.resolve();
    await controller.reset();
    pending.resolve(adapter);
    await running;
    expect(adapter.destroy).toHaveBeenCalledOnce();
    expect(adapter.load).not.toHaveBeenCalled();
    expect(update).toHaveBeenLastCalledWith('idle');
  });
  it('前の破棄中に変更されたら新しいプレイヤーを作らない', async () => {
    const pending = deferred<void>();
    const adapter = player();
    const factory = vi.fn(async () => adapter);
    const controller = createPlaybackController(factory, vi.fn());
    await controller.start(video, request);
    vi.mocked(adapter.destroy).mockReturnValue(pending.promise);
    const running = controller.start(video, request);
    await controller.reset();
    pending.resolve();
    await running;
    expect(factory).toHaveBeenCalledOnce();
  });
  it.each([true, false])(
    '古いloadの結果はリセット後の状態を変えない（成功=%s）',
    async (success) => {
      const pending = deferred<void>();
      const adapter = player();
      vi.mocked(adapter.load).mockReturnValue(pending.promise);
      const update = vi.fn();
      const controller = createPlaybackController(async () => adapter, update);
      const running = controller.start(video, request);
      await Promise.resolve();
      await Promise.resolve();
      await controller.reset();
      if (success) {
        pending.resolve();
      } else {
        pending.reject(new Error('old-error'));
      }
      await running;
      expect(update).toHaveBeenLastCalledWith('idle');
    },
  );
});
