import type { StoredRecord } from '../../src/entities/record/model/record-schema';

export function createRecordFixture(): StoredRecord {
  return {
    record: {
      id: crypto.randomUUID(),
      createdAt: '2026-10-12T00:00:00.000Z',
      materialName: 'Sintel / Widevine',
      connectionName: 'Shaka 公開テスト',
      mode: 'normal',
      robustness: 'default',
      capability: 'supported',
      playback: 'playing',
      environment: {
        os: 'Windows 11',
        chrome: '140',
        device: '検証PC',
        browser: 'Chrome',
      },
      captureMethod: 'Win + Shift + S',
      observation: 'black',
      memo: '映像部分を確認',
      images: [],
    },
    images: {},
  };
}
