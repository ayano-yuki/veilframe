import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { ref } from 'vue';
import ConnectionsPage from './ConnectionsPage.vue';

const mocks = vi.hoisted(() => ({
  result: {
    data: {
      value: {
        localEnabled: false,
        connections: [{ id: 'shaka-widevine', name: 'Shaka 公開テスト' }],
      },
    } as {
      value:
        | { localEnabled: boolean; connections: { id: string; name: string }[] }
        | undefined;
    },
    error: { value: null as Error | null },
  },
}));
mockNuxtImport('useFetch', () => () => mocks.result);
beforeEach(() => {
  mocks.result = {
    data: ref({
      localEnabled: false,
      connections: [{ id: 'test', name: '検証先' }],
    }),
    error: ref(null),
  };
});
describe('接続設定画面', () => {
  it.each([true, false])(
    '公開情報だけを表示する（ローカル=%s）',
    async (localEnabled) => {
      mocks.result.data.value = {
        localEnabled,
        connections: [{ id: 'test', name: '検証先' }],
      };
      mocks.result.error.value = null;
      const wrapper = await mountSuspended(ConnectionsPage);
      expect(wrapper.text()).toContain('検証先');
      expect(wrapper.text()).toContain(
        localEnabled ? '独自接続が有効' : '公開テスト素材',
      );
      wrapper.unmount();
    },
  );
  it('取得失敗とデータなしの状態を表示する', async () => {
    mocks.result.error.value = new Error('private');
    const failed = await mountSuspended(ConnectionsPage);
    expect(failed.get('[role="alert"]').text()).toContain('読み込めません');
    failed.unmount();
    mocks.result.error.value = null;
    mocks.result.data.value = undefined;
    const empty = await mountSuspended(ConnectionsPage);
    expect(empty.findAll('dl')).toHaveLength(0);
    empty.unmount();
  });
});
