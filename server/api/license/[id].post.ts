import {
  createError,
  defineEventHandler,
  getRouterParam,
  setResponseHeader,
} from 'h3';
import { useRuntimeConfig } from '#imports';
import { resolveConnections } from '../../domain/resolve-connections';
import { readLicenseBody } from '../../application/read-license-body';
import { createLicenseTransport } from '../../infrastructure/create-license-transport';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const connections = resolveConnections(
    config.localConnectionsEnabled,
    config.connectionsJson,
    process.env.VERCEL === '1',
  );
  const connection = connections.find(
    (item) => item.id === getRouterParam(event, 'id'),
  );
  if (!connection) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Connection unavailable',
    });
  }
  let body: Uint8Array;
  try {
    body = await readLicenseBody(event.node.req);
  } catch {
    throw createError({
      statusCode: 413,
      statusMessage: 'Invalid license request size',
    });
  }
  try {
    const response = await createLicenseTransport().send(
      connection,
      new Uint8Array(body),
    );
    setResponseHeader(event, 'Content-Type', 'application/octet-stream');
    setResponseHeader(event, 'Cache-Control', 'no-store');
    return Buffer.from(response);
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'License request failed',
    });
  }
});
