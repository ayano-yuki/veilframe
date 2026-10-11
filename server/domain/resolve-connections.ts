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
  const publicConnections: LicenseConnection[] = [
    {
      id: 'shaka-widevine',
      name: 'Shaka 公開テスト',
      drm: 'widevine',
      url: 'https://proxy.uat.widevine.com/proxy',
      headers: {},
    },
    {
      id: 'microsoft-playready',
      name: 'Microsoft PlayReady 公開テスト',
      drm: 'playready',
      url: 'https://test.playready.microsoft.com/service/rightsmanager.asmx?cfg=(persist:false,sl:150)',
      headers: {},
    },
  ];
  if (vercel || (enabled !== true && enabled !== 'true')) {
    return publicConnections;
  }
  const custom = z.array(connectionSchema).parse(JSON.parse(connectionsJson));
  const ids = custom.map((connection) => connection.id);
  if (
    publicConnections.some((connection) => ids.includes(connection.id)) ||
    new Set(ids).size !== ids.length
  ) {
    throw new Error('接続先IDが重複しています。');
  }
  return [...publicConnections, ...custom];
}
