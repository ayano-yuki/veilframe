import { defineEventHandler, setResponseHeader } from 'h3';
import { useRuntimeConfig } from '#imports';
import { resolveConnections } from '../domain/resolve-connections';

export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event);
  const vercel = process.env.VERCEL === '1';
  const connections = resolveConnections(
    config.localConnectionsEnabled,
    config.connectionsJson,
    vercel,
  );
  const localEnabled =
    !vercel &&
    (config.localConnectionsEnabled === true ||
      String(config.localConnectionsEnabled) === 'true');
  setResponseHeader(event, 'Cache-Control', 'no-store');
  return {
    localEnabled,
    connections: connections.map(({ id, name, drm }) => ({ id, name, drm })),
    ...(localEnabled
      ? {
          defaults: {
            manifestUrl: config.defaultManifestUrl,
            connectionId: config.defaultConnectionId,
          },
        }
      : {}),
  };
});
