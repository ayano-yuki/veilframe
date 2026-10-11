import { imageLimit, recordSchema, type StoredRecord } from './record-schema';

export function validateEntry(entry: StoredRecord): StoredRecord {
  const record = recordSchema.parse(entry.record);
  const ids = record.images.map((image) => image.id);
  if (Object.keys(entry.images).length !== ids.length) {
    throw new Error('記録と画像ファイルが一致しません。');
  }
  for (const image of record.images) {
    const blob = entry.images[image.id];
    if (
      !blob ||
      blob.size !== image.size ||
      blob.type !== image.type ||
      blob.size > imageLimit
    ) {
      throw new Error('画像ファイルが不正です。');
    }
  }
  return { record, images: entry.images };
}
