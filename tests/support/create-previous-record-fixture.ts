import { createRecordFixture } from './create-record-fixture';

export function createPreviousRecordFixture() {
  const entry = createRecordFixture();
  return {
    record: {
      id: entry.record.id,
      createdAt: entry.record.createdAt,
      materialName: entry.record.materialName,
      connectionName: entry.record.connectionName,
      mode: entry.record.mode,
      robustness: 'default' as const,
      capability: entry.record.capability,
      playback: entry.record.playback,
      environment: entry.record.environment,
      captureMethod: entry.record.captureMethod,
      observation: entry.record.observation,
      memo: entry.record.memo,
      images: entry.record.images,
    },
    images: entry.images,
  };
}
