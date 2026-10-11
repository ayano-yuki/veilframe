import { strFromU8, strToU8, Unzip, UnzipInflate, zipSync } from 'fflate';
import { z } from 'zod';
import {
  archiveLimit,
  expandedLimit,
  legacyRecordSchema,
  recordSchema,
  previousRecordSchema,
  type StoredRecord,
} from '@fsd/entities/record/model/record-schema';
import { validateEntry } from '@fsd/entities/record/model/validate-entry';

const archiveSchema = z.discriminatedUnion('version', [
  z
    .object({
      version: z.literal(1),
      records: z.array(legacyRecordSchema).max(1000),
    })
    .strict(),
  z
    .object({
      version: z.literal(2),
      records: z.array(previousRecordSchema).max(1000),
    })
    .strict(),
  z
    .object({ version: z.literal(3), records: z.array(recordSchema).max(1000) })
    .strict(),
]);

export async function exportRecords(
  entries: StoredRecord[],
): Promise<Uint8Array> {
  const valid = entries.map(validateEntry);
  const document = archiveSchema.parse({
    version: 3,
    records: valid.map((entry) => entry.record),
  });
  const files: Record<string, Uint8Array> = {
    'records.json': strToU8(JSON.stringify(document, null, 2)),
  };
  let total = files['records.json']!.byteLength;
  for (const entry of valid) {
    for (const image of entry.record.images) {
      const bytes = new Uint8Array(await entry.images[image.id]!.arrayBuffer());
      total += bytes.byteLength;
      if (total > expandedLimit) {
        throw new Error('展開後の容量上限を超えています。');
      }
      const name = `images/${entry.record.id}/${image.id}`;
      if (files[name]) {
        throw new Error('記録IDが重複しています。');
      }
      files[name] = bytes;
    }
  }
  const zip = zipSync(files, { level: 0 });
  if (zip.byteLength > archiveLimit) {
    throw new Error('ZIPの容量上限を超えています。');
  }
  return zip;
}

export function importRecords(bytes: Uint8Array): StoredRecord[] {
  if (bytes.byteLength === 0 || bytes.byteLength > archiveLimit) {
    throw new Error('ZIPの容量上限または形式が不正です。');
  }
  const files: Record<string, Uint8Array> = Object.create(null);
  let total = 0;
  let count = 0;
  let failure: Error | undefined;
  const unzip = new Unzip((file) => {
    count++;
    if (
      count > 5001 ||
      files[file.name] ||
      (file.name !== 'records.json' &&
        !/^images\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/.test(file.name))
    ) {
      failure = new Error('ZIP内のファイル名または件数が不正です。');
      file.terminate();
      return;
    }
    files[file.name] = new Uint8Array();
    const chunks: Uint8Array[] = [];
    let length = 0;
    file.ondata = (error, chunk, final) => {
      if (error) {
        failure = new Error('ZIPを展開できませんでした。');
        return;
      }
      total += chunk.byteLength;
      length += chunk.byteLength;
      if (total > expandedLimit) {
        failure = new Error('展開後の容量上限を超えています。');
        file.terminate();
        return;
      }
      chunks.push(chunk);
      if (final) {
        const output = new Uint8Array(length);
        let offset = 0;
        for (const part of chunks) {
          output.set(part, offset);
          offset += part.byteLength;
        }
        files[file.name] = output;
      }
    };
    file.start();
  });
  unzip.register(UnzipInflate);
  for (let offset = 0; offset < bytes.length; offset += 1024) {
    unzip.push(
      bytes.subarray(offset, offset + 1024),
      offset + 1024 >= bytes.length,
    );
    if (failure) {
      throw failure;
    }
  }
  const document = archiveSchema.parse(
    JSON.parse(strFromU8(files['records.json'] ?? new Uint8Array())),
  );
  if (
    new Set(document.records.map((record) => record.id)).size !==
    document.records.length
  ) {
    throw new Error('記録IDが重複しています。');
  }
  const used = new Set(['records.json']);
  const entries = document.records.map((record) => {
    const images: Record<string, Blob> = {};
    for (const image of record.images) {
      const name = `images/${record.id}/${image.id}`;
      const imageBytes = files[name];
      if (!imageBytes) {
        throw new Error('添付画像が不足しています。');
      }
      used.add(name);
      images[image.id] = new Blob([new Uint8Array(imageBytes)], {
        type: image.type,
      });
    }
    return validateEntry({ record, images });
  });
  if (used.size !== Object.keys(files).length) {
    throw new Error('記録に含まれないファイルがあります。');
  }
  return entries;
}
