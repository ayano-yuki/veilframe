import type { LicenseConnection } from '../../src/shared/api/connection-schema';

export const licenseLimit = 1024 * 1024;
export interface LicenseTransport {
  send(connection: LicenseConnection, body: Uint8Array): Promise<Uint8Array>;
}
