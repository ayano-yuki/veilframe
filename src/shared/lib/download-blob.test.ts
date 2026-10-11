import { expect, it, vi } from 'vitest';
import { downloadBlob } from './download-blob';

it('ダウンロード後にObject URLを解放する', async () => {
  vi.useFakeTimers();
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => undefined);
  const blob = new Blob(['zip']);
  downloadBlob(blob, 'records.zip');
  expect(create).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalledOnce();
  await vi.advanceTimersByTimeAsync(1000);
  expect(revoke).toHaveBeenCalledWith('blob:test');
  vi.restoreAllMocks();
  vi.useRealTimers();
});
