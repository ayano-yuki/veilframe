import { describe, expect, it } from 'vitest';
import { licenseLimit } from '../domain/license-transport';
import { readLicenseBody } from './read-license-body';

async function* stream(chunks: Uint8Array[]) {
  for (const chunk of chunks) {
    yield chunk;
  }
}
describe('要求のストリーム上限', () => {
  it('複数チャンクをまとめる', async () => {
    expect(
      await readLicenseBody(stream([new Uint8Array([1]), new Uint8Array([2])])),
    ).toEqual(new Uint8Array([1, 2]));
  });
  it('空の要求と上限超過を拒否する', async () => {
    await expect(readLicenseBody(stream([]))).rejects.toThrow('empty-request');
    await expect(
      readLicenseBody(
        stream([new Uint8Array(licenseLimit), new Uint8Array([1])]),
      ),
    ).rejects.toThrow('request-too-large');
  });
});
