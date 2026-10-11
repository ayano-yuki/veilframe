import { z } from 'zod';

export const connectionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{1,80}$/),
    name: z.string().min(1).max(200),
    drm: z.enum(['widevine', 'playready']).default('widevine'),
    url: z
      .url()
      .refine(
        (value) =>
          new URL(value).protocol === 'https:' &&
          !new URL(value).username &&
          !new URL(value).password,
      ),
    headers: z.record(
      z.string().regex(/^[A-Za-z0-9-]+$/),
      z.string().max(4096),
    ),
  })
  .strict();
export type LicenseConnection = z.infer<typeof connectionSchema>;
