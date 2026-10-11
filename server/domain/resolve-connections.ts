import { z } from 'zod';
import {
  connectionSchema,
  type LicenseConnection,
} from '../../src/shared/api/connection-schema';

export function resolveConnections(
  enabled: unknown,
  connectionsJson: string,
  vercel: boolean,
): LicenseConnection[] {
  const publicConnection: LicenseConnection = {
    id: 'shaka-widevine',
    name: 'Shaka 公開テスト',
    url: 'https://proxy.uat.widevine.com/proxy',
    headers: {},
  };
  if (vercel || (enabled !== true && enabled !== 'true')) {
    return [publicConnection];
  }
  const custom = z.array(connectionSchema).parse(JSON.parse(connectionsJson));
  const ids = custom.map((connection) => connection.id);
  if (ids.includes(publicConnection.id) || new Set(ids).size !== ids.length) {
    throw new Error('接続先IDが重複しています。');
  }
  return [publicConnection, ...custom];
}
