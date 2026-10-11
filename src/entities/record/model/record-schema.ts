import { z } from 'zod';

export const imageLimit = 10 * 1024 * 1024;
export const archiveLimit = 100 * 1024 * 1024;
export const expandedLimit = 200 * 1024 * 1024;
export const imageTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;

export const imageSchema = z
  .object({
    id: z.uuid(),
    type: z.enum(imageTypes),
    size: z.number().int().positive().max(imageLimit),
  })
  .strict();

export const recordSchema = z
  .object({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    materialName: z.string().trim().min(1).max(200),
    connectionName: z.string().trim().min(1).max(200),
    mode: z.enum(['normal', 'hardware']),
    robustness: z.enum(['default', 'HW_SECURE_ALL']),
    capability: z.enum(['unknown', 'supported', 'unsupported']),
    playback: z.enum(['idle', 'playing', 'failed']),
    environment: z
      .object({
        os: z.string().max(200),
        chrome: z.string().max(200),
        device: z.string().max(200),
        browser: z.string().max(500),
      })
      .strict(),
    captureMethod: z.string().max(200),
    observation: z.enum(['visible', 'black', 'other', 'unchecked']),
    memo: z.string().max(5000),
    images: z.array(imageSchema).max(5),
  })
  .strict()
  .refine(
    (record) =>
      record.robustness ===
      (record.mode === 'hardware' ? 'HW_SECURE_ALL' : 'default'),
    '再生モードと保護要件が一致しません。',
  )
  .refine(
    (record) =>
      new Set(record.images.map((image) => image.id)).size ===
      record.images.length,
    '画像IDが重複しています。',
  );

export type CaptureRecord = z.infer<typeof recordSchema>;
export type ImageDescriptor = z.infer<typeof imageSchema>;
export interface StoredRecord {
  record: CaptureRecord;
  images: Record<string, Blob>;
}
