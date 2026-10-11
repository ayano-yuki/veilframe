import { afterEach, describe, expect, it, vi } from 'vitest';
import { Blob as NodeBlob } from 'node:buffer';
import { createRecordFixture } from '../../../../tests/support/create-record-fixture';
import { createLegacyRecordFixture } from '../../../../tests/support/create-legacy-record-fixture';
import { createRecordRepository } from './create-record-repository';

afterEach(() => vi.restoreAllMocks());
describe('IndexedDB実装', () => {
  it('既存DBの旧記録と画像を保持して新形式として読み込む', async () => {
    const name = crypto.randomUUID();
    const repository = createRecordRepository(name);
    await repository.close();
    const legacy = createLegacyRecordFixture();
    const id = crypto.randomUUID();
    legacy.record.images = [{ id, type: 'image/png', size: 3 }];
    legacy.images[id] = new NodeBlob(['png'], { type: 'image/png' });
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(name, 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      transaction.objectStore('records').put(legacy);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    const reopened = createRecordRepository(name);
    const entries = await reopened.list();
    expect(entries[0]?.record.environment.browserName).toBe('unknown');
    expect(entries[0]?.record.environment.browserVersion).toBe('140');
    expect(await entries[0]?.images[id]?.text()).toBe('png');
    await reopened.close();
  });
  it('保存・新しい順の一覧・削除・再接続を提供する', async () => {
    const name = crypto.randomUUID();
    const repository = createRecordRepository(name);
    const first = createRecordFixture();
    const second = createRecordFixture();
    second.record.createdAt = '2026-10-13T00:00:00.000Z';
    await repository.save(first);
    await repository.save(second);
    expect((await repository.list()).map((entry) => entry.record.id)).toEqual([
      second.record.id,
      first.record.id,
    ]);
    await repository.close();
    const reopened = createRecordRepository(name);
    expect(await reopened.list()).toHaveLength(2);
    await reopened.remove(first.record.id);
    expect(await reopened.list()).toHaveLength(1);
    await reopened.close();
    const defaultRepository = createRecordRepository();
    await defaultRepository.close();
  });
  it('インポートの重複をスキップして既存記録を保持する', async () => {
    const repository = createRecordRepository(crypto.randomUUID());
    const first = createRecordFixture();
    const second = createRecordFixture();
    await repository.save(first);
    const modified = structuredClone(first);
    modified.record.memo = '上書きしない';
    expect(await repository.importAll([modified, second])).toEqual({
      imported: 1,
      skipped: 1,
    });
    expect(
      (await repository.list()).find(
        (entry) => entry.record.id === first.record.id,
      )?.record.memo,
    ).toBe(first.record.memo);
    expect(await repository.importAll([])).toEqual({ imported: 0, skipped: 0 });
    await repository.close();
  });
  it('検証に失敗したら保存しない', async () => {
    const repository = createRecordRepository(crypto.randomUUID());
    const invalid = createRecordFixture();
    invalid.record.materialName = '';
    await expect(
      repository.importAll([createRecordFixture(), invalid]),
    ).rejects.toThrow();
    expect(await repository.list()).toEqual([]);
    await repository.close();
  });
  it.each([false, true])(
    '書き込み失敗では全件ロールバックする（既に中止済み=%s）',
    async (alreadyAborted) => {
      const repository = createRecordRepository(crypto.randomUUID());
      const original = IDBObjectStore.prototype.add;
      let calls = 0;
      vi.spyOn(IDBObjectStore.prototype, 'add').mockImplementation(function (
        this: IDBObjectStore,
        value,
        key,
      ) {
        if (++calls === 2) {
          if (alreadyAborted) {
            this.transaction.abort();
          }
          throw new Error('disk-full');
        }
        return original.call(this, value, key);
      });
      await expect(
        repository.importAll([createRecordFixture(), createRecordFixture()]),
      ).rejects.toThrow('disk-full');
      expect(await repository.list()).toEqual([]);
      await repository.close();
    },
  );
});
