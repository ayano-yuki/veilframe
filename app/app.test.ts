import { expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import App from './app.vue';
import IndexPage from './pages/index.vue';
import RecordsRoute from './pages/records.vue';
import ConnectionsRoute from './pages/connections.vue';

it('ナビゲーションと薄いルートを描画する', async () => {
  const app = await mountSuspended(App, {
    global: { stubs: { NuxtPage: true } },
  });
  expect(app.findAll('nav a').map((link) => link.attributes('href'))).toEqual([
    '/',
    '/records',
    '/connections',
  ]);
  app.unmount();
  const route = await mountSuspended(IndexPage, {
    global: { stubs: { PlaybackPage: true } },
  });
  expect(route.find('playback-page-stub').exists()).toBe(true);
  route.unmount();
  const records = await mountSuspended(RecordsRoute, {
    global: { stubs: { RecordsPage: true } },
  });
  expect(records.find('records-page-stub').exists()).toBe(true);
  records.unmount();
  const connections = await mountSuspended(ConnectionsRoute, {
    global: { stubs: { ConnectionsPage: true } },
  });
  expect(connections.find('connections-page-stub').exists()).toBe(true);
  connections.unmount();
});
