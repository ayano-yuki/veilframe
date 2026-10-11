import { fileURLToPath } from 'node:url';
import { defineNuxtConfig } from 'nuxt/config';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-12',
  srcDir: 'app',
  serverDir: 'server',
  alias: {
    ...(process.env.VEILFRAME_UI_TEST === '1' && process.env.VERCEL !== '1'
      ? {
          '@fsd/entities/playback/api/create-shaka-player': fileURLToPath(
            new URL('./tests/support/create-test-player.ts', import.meta.url),
          ),
        }
      : {}),
    '@fsd': fileURLToPath(new URL('./src', import.meta.url)),
  },
  modules: ['@pinia/nuxt'],
  imports: { autoImport: false, scan: false },
  components: { dirs: [] },
  ssr: true,
  devtools: { enabled: false },
  css: ['@fsd/shared/ui/base.css'],
  typescript: { strict: true },
  runtimeConfig: {
    localConnectionsEnabled: false,
    connectionsJson: '[]',
    defaultManifestUrl: '',
    defaultConnectionId: '',
  },
  app: {
    head: {
      htmlAttrs: { lang: 'ja' },
      title: 'veilframe — 保護映像の検証',
      meta: [
        {
          name: 'description',
          content: 'DRM再生とキャプチャ挙動を実機で比較する検証ツール。',
        },
      ],
    },
  },
});
