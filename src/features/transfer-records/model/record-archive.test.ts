import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createRecordFixture } from '../../../../tests/support/create-record-fixture';
import { createLegacyRecordFixture } from '../../../../tests/support/create-legacy-record-fixture';
import {
  archiveLimit,
  expandedLimit,
  imageLimit,
} from '@fsd/entities/record/model/record-schema';
import { exportRecords, importRecords } from './record-archive';

describe('ZIPの交換', () => {
  it('旧ZIPの種類を推測せず変換し、新ZIPはversion 2として出力する', async () => {
    const legacy = createLegacyRecordFixture();
    const id = crypto.randomUUID();
    legacy.record.images = [{ id, type: 'image/png', size: 3 }];
    const restored = importRecords(
      zipSync({
        'records.json': strToU8(
          JSON.stringify({ version: 1, records: [legacy.record] }),
        ),
        [`images/${legacy.record.id}/${id}`]: strToU8('png'),
      }),
    );
    expect(restored[0]?.record.environment.browserName).toBe('unknown');
    expect(restored[0]?.record.environment.browserVersion).toBe('140');
    expect(await restored[0]?.images[id]?.text()).toBe('png');
    const document = JSON.parse(
      strFromU8(unzipSync(await exportRecords(restored))['records.json']!),
    );
    expect(document.version).toBe(2);
    expect(document.records[0].environment).not.toHaveProperty('chrome');
    for (const [version, record] of [
      [1, createRecordFixture().record],
      [2, legacy.record],
      [3, legacy.record],
    ]) {
      expect(() =>
        importRecords(
          zipSync({
            'records.json': strToU8(
              JSON.stringify({ version, records: [record] }),
            ),
          }),
        ),
      ).toThrow();
    }
  });
  it('画像付き記録を往復し、動画URLや認証情報を含めない', async () => {
    const entry = createRecordFixture();
    const id = crypto.randomUUID();
    entry.images[id] = new Blob(['image'], { type: 'image/png' });
    entry.record.images = [{ id, type: 'image/png', size: 5 }];
    const bytes = await exportRecords([entry]);
    const restored = importRecords(bytes);
    expect(restored[0]?.record).toEqual(entry.record);
    expect(await restored[0]?.images[id]?.text()).toBe('image');
    expect(importRecords(await exportRecords([]))).toEqual([]);
  });
  it('不正な入力と未知のファイル名を拒否する', () => {
    for (const bytes of [
      new Uint8Array(),
      new Uint8Array(archiveLimit + 1),
      strToU8('not-a-zip'),
      zipSync({ '../escape': strToU8('x') }),
      zipSync({ 'records.json': strToU8('{}') }),
    ]) {
      expect(() => importRecords(bytes)).toThrow();
    }
  });
  it('記録IDの重複と欠けた画像を拒否する', async () => {
    const entry = createRecordFixture();
    expect(() =>
      importRecords(
        zipSync({
          'records.json': strToU8(
            JSON.stringify({
              version: 2,
              records: [entry.record, entry.record],
            }),
          ),
        }),
      ),
    ).toThrow('記録ID');
    entry.record.images = [
      { id: crypto.randomUUID(), type: 'image/png', size: 1 },
    ];
    expect(() =>
      importRecords(
        zipSync({
          'records.json': strToU8(
            JSON.stringify({ version: 2, records: [entry.record] }),
          ),
        }),
      ),
    ).toThrow('添付画像');
    entry.images[entry.record.images[0]!.id] = new Blob(['a'], {
      type: 'image/png',
    });
    await expect(exportRecords([entry, entry])).rejects.toThrow('記録ID');
  });
  it('記録にない添付ファイルを拒否する', () => {
    const name = `images/${crypto.randomUUID()}/${crypto.randomUUID()}`;
    expect(() =>
      importRecords(
        zipSync({
          'records.json': strToU8(JSON.stringify({ version: 2, records: [] })),
          [name]: strToU8('extra'),
        }),
      ),
    ).toThrow('記録に含まれない');
  });
  it('複数チャンクで展開した記録を読み込む', async () => {
    const entry = createRecordFixture();
    entry.record.memo = '検証結果'.repeat(1000);
    expect(importRecords(await exportRecords([entry]))[0]?.record.memo).toBe(
      entry.record.memo,
    );
  });
  it('未対応のZIP圧縮形式を拒否する', () => {
    const bytes = zipSync({ 'records.json': strToU8('{}') });
    bytes[8] = 99;
    bytes[9] = 0;
    expect(() => importRecords(bytes)).toThrow();
  });
  it('展開後の容量制限でZIP bombを中止する', () => {
    const name = `images/${crypto.randomUUID()}/${crypto.randomUUID()}`;
    const bytes = zipSync(
      { [name]: new Uint8Array(expandedLimit + 1) },
      { level: 9 },
    );
    expect(() => importRecords(bytes)).toThrow('展開後の容量');
  }, 20000);
  it('ファイル件数を制限する', () => {
    const files: Record<string, Uint8Array> = {};
    for (let index = 0; index < 5002; index++) {
      files[`images/${crypto.randomUUID()}/${crypto.randomUUID()}`] =
        new Uint8Array();
    }
    expect(() => importRecords(zipSync(files))).toThrow('件数');
  });
  it.each([11, 21])(
    'エクスポート容量を制限する（画像数=%s）',
    async (count) => {
      const image = new Blob([new Uint8Array(imageLimit)], {
        type: 'image/png',
      });
      const entries = Array.from({ length: Math.ceil(count / 5) }, () =>
        createRecordFixture(),
      );
      for (let index = 0; index < count; index++) {
        const entry = entries[Math.floor(index / 5)]!;
        const id = crypto.randomUUID();
        entry.images[id] = image;
        entry.record.images.push({ id, type: 'image/png', size: imageLimit });
      }
      await expect(exportRecords(entries)).rejects.toThrow(
        count === 11 ? 'ZIPの容量' : '展開後の容量',
      );
    },
    20000,
  );
});
