import { createRecordFixture } from './create-record-fixture';

export function createLegacyRecordFixture() {
  const entry = createRecordFixture();
  return {
    record: {
      ...entry.record,
      environment: {
        os: entry.record.environment.os,
        chrome: entry.record.environment.browserVersion,
        device: entry.record.environment.device,
        browser: entry.record.environment.browser,
      },
    },
    images: entry.images,
  };
}
