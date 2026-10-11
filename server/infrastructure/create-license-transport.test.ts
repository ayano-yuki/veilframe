import { afterEach, describe, expect, it, vi } from 'vitest';
import { licenseLimit } from '../domain/license-transport';
import { createLicenseTransport } from './create-license-transport';

const connection = {
  id: 'test',
  name: 'Test',
  url: 'https://example.test/license',
  headers: { Authorization: 'private' },
};
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});
describe('ライセンス転送', () => {
  it('認証情報をサーバーで付与し、リダイレクトを拒否してバイナリを返す', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(new Uint8Array([4, 5])));
    expect(
      await createLicenseTransport(fetcher).send(
        connection,
        new Uint8Array([1, 2]),
      ),
    ).toEqual(new Uint8Array([4, 5]));
    expect(fetcher).toHaveBeenCalledWith(
      connection.url,
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: 'private',
          'Content-Type': 'application/octet-stream',
        },
      }),
    );
  });
  it('既定のfetchも利用できる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('license')));
    expect(
      await createLicenseTransport().send(connection, new Uint8Array([1])),
    ).toHaveLength(7);
    vi.unstubAllGlobals();
  });
  it.each([new Uint8Array(), new Uint8Array(licenseLimit + 1)])(
    '入力容量の上限で外部送信を止める',
    async (body) => {
      const fetcher = vi.fn<typeof fetch>();
      await expect(
        createLicenseTransport(fetcher).send(connection, body),
      ).rejects.toThrow('invalid-request');
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    new Response('denied', { status: 403 }),
    new Response(null),
    new Response(new Uint8Array()),
  ])('失敗・本文なし・空の応答を拒否する', async (response) => {
    await expect(
      createLicenseTransport(
        vi.fn<typeof fetch>().mockResolvedValue(response),
      ).send(connection, new Uint8Array([1])),
    ).rejects.toThrow();
  });
  it('応答をストリームで読み、容量超過時に中止する', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(licenseLimit));
        controller.enqueue(new Uint8Array([1]));
      },
      cancel,
    });
    await expect(
      createLicenseTransport(
        vi.fn<typeof fetch>().mockResolvedValue(new Response(body)),
      ).send(connection, new Uint8Array([1])),
    ).rejects.toThrow('response-too-large');
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('15秒で中止し、自動再試行しない', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('timeout')),
          );
        }),
    );
    const running = createLicenseTransport(fetcher).send(
      connection,
      new Uint8Array([1]),
    );
    const rejected = expect(running).rejects.toThrow('timeout');
    await vi.advanceTimersByTimeAsync(15000);
    await rejected;
    expect(fetcher).toHaveBeenCalledOnce();
  });
});
