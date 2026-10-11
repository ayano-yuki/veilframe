import { describe, expect, it } from 'vitest';
import { createRecordFixture } from '../../../../tests/support/create-record-fixture';
import { createLegacyRecordFixture } from '../../../../tests/support/create-legacy-record-fixture';
import { imageLimit, recordSchema, storedRecordSchema } from './record-schema';
import { validateEntry } from './validate-entry';

describe('記録の契約', () => {
  it('ブラウザ種類は手動値だけを受け付け、旧種類を推測しない', () => {
    const entry = createRecordFixture();
    for (const browserName of ['unknown', 'chrome', 'brave']) {
      expect(
        recordSchema.parse({
          ...entry.record,
          environment: { ...entry.record.environment, browserName },
        }).environment.browserName,
      ).toBe(browserName);
    }
    expect(() =>
      recordSchema.parse({
        ...entry.record,
        environment: { ...entry.record.environment, browserName: 'other' },
      }),
    ).toThrow();
    const legacy = createLegacyRecordFixture();
    const converted = storedRecordSchema.parse(legacy.record);
    expect(converted.environment).toEqual({
      os: 'Windows 11',
      browserName: 'unknown',
      browserVersion: '140',
      device: '検証PC',
      browser: 'Chrome',
    });
    expect(() =>
      storedRecordSchema.parse({
        ...legacy.record,
        environment: { ...legacy.record.environment, secret: 'token' },
      }),
    ).toThrow();
    expect(() => recordSchema.parse(legacy.record)).toThrow();
  });
  it('モードと保護要件の整合性を検証する', () => {
    const entry = createRecordFixture();
    expect(recordSchema.parse(entry.record)).toEqual(entry.record);
    expect(() =>
      recordSchema.parse({ ...entry.record, mode: 'hardware' }),
    ).toThrow();
    expect(
      recordSchema.parse({
        ...entry.record,
        mode: 'hardware',
        robustness: 'HW_SECURE_ALL',
      }).robustness,
    ).toBe('HW_SECURE_ALL');
  });
  it('未知のフィールド・URL・認証情報を受け付けない', () => {
    expect(() =>
      recordSchema.parse({
        ...createRecordFixture().record,
        manifestUrl: 'https://example.test/private',
      }),
    ).toThrow();
  });
  it('画像の個数・容量・ID重複・実データの一致を検証する', () => {
    const entry = createRecordFixture();
    const id = crypto.randomUUID();
    const image = { id, type: 'image/png' as const, size: 3 };
    entry.record.images = [image];
    entry.images[id] = new Blob(['png'], { type: 'image/png' });
    expect(validateEntry(entry)).toEqual(entry);
    expect(() => validateEntry({ ...entry, images: {} })).toThrow();
    expect(() =>
      validateEntry({
        ...entry,
        images: { [crypto.randomUUID()]: entry.images[id]! },
      }),
    ).toThrow();
    expect(() =>
      validateEntry({
        ...entry,
        images: { [id]: new Blob(['wrong'], { type: 'image/png' }) },
      }),
    ).toThrow();
    expect(() =>
      validateEntry({
        ...entry,
        images: { [id]: new Blob(['png'], { type: 'image/jpeg' }) },
      }),
    ).toThrow();
    expect(() =>
      recordSchema.parse({ ...entry.record, images: [image, image] }),
    ).toThrow();
    expect(() =>
      recordSchema.parse({
        ...entry.record,
        images: [{ ...image, size: imageLimit + 1 }],
      }),
    ).toThrow();
    expect(() =>
      recordSchema.parse({
        ...entry.record,
        images: Array.from({ length: 6 }, () => ({
          ...image,
          id: crypto.randomUUID(),
        })),
      }),
    ).toThrow();
  });
});
