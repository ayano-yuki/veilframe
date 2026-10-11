import { licenseLimit } from '../domain/license-transport';

export async function readLicenseBody(
  stream: AsyncIterable<Uint8Array>,
): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let length = 0;
  for await (const chunk of stream) {
    length += chunk.byteLength;
    if (length > licenseLimit) {
      throw new Error('request-too-large');
    }
    chunks.push(chunk);
  }
  if (length === 0) {
    throw new Error('empty-request');
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}
