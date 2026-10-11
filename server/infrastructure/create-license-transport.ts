import {
  licenseLimit,
  type LicenseTransport,
} from '../domain/license-transport';

export function createLicenseTransport(
  fetcher: typeof fetch = fetch,
): LicenseTransport {
  return {
    async send(connection, body) {
      if (body.byteLength === 0 || body.byteLength > licenseLimit) {
        throw new Error('invalid-request');
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetcher(connection.url, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: {
            ...connection.headers,
            'Content-Type': 'application/octet-stream',
          },
          body: new Uint8Array(body),
        });
        if (!response.ok || !response.body) {
          throw new Error('upstream-failed');
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let length = 0;
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) {
              break;
            }
            length += chunk.value.byteLength;
            if (length > licenseLimit) {
              await reader.cancel();
              throw new Error('response-too-large');
            }
            chunks.push(chunk.value);
          }
        } finally {
          reader.releaseLock();
        }
        if (length === 0) {
          throw new Error('empty-response');
        }
        const output = new Uint8Array(length);
        let offset = 0;
        for (const chunk of chunks) {
          output.set(chunk, offset);
          offset += chunk.byteLength;
        }
        return output;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
