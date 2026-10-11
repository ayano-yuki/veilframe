import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRecordFixture } from '../../../../tests/support/create-record-fixture';
import { createRecordRepository } from './create-record-repository';

afterEach(() => vi.restoreAllMocks());
describe('IndexedDB実装', () => {
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
