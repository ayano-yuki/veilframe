import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { createRecordFixture } from '../../../../tests/support/create-record-fixture';
import RecordsPage from './RecordsPage.vue';
import type { StoredRecord } from '@fsd/entities/record/model/record-schema';

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
  close: vi.fn(),
  importAll: vi.fn(),
  exportRecords: vi.fn(),
  importRecords: vi.fn(),
  download: vi.fn(),
}));
vi.mock('@fsd/entities/record/api/create-record-repository', () => ({
  createRecordRepository: () => ({
    list: mocks.list,
    remove: mocks.remove,
    close: mocks.close,
    importAll: mocks.importAll,
  }),
}));
vi.mock('@fsd/features/transfer-records/model/record-archive', () => ({
  exportRecords: mocks.exportRecords,
  importRecords: mocks.importRecords,
}));
vi.mock('@fsd/shared/lib/download-blob', () => ({
  downloadBlob: mocks.download,
}));
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:fixture');
  mocks.list.mockResolvedValue([]);
  mocks.close.mockResolvedValue(undefined);
  mocks.remove.mockResolvedValue(undefined);
  mocks.exportRecords.mockResolvedValue(new Uint8Array([1]));
  mocks.importRecords.mockReturnValue([]);
  mocks.importAll.mockResolvedValue({ imported: 1, skipped: 2 });
});
async function mountPage() {
  const wrapper = await mountSuspended(RecordsPage);
  await flushPromises();
  return wrapper;
}
async function importFile(
  wrapper: Awaited<ReturnType<typeof mountSuspended>>,
  file?: File,
) {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, 'files', {
    value: file ? [file] : [],
    configurable: true,
  });
  await input.trigger('change');
  await flushPromises();
}
function imageEntry(): StoredRecord {
  const entry = createRecordFixture();
  const id = crypto.randomUUID();
  entry.images[id] = new Blob(['png'], { type: 'image/png' });
  entry.record.images = [{ id, type: 'image/png', size: 3 }];
  return entry;
}
describe('記録画面', () => {
  it('空の記録と一覧取得失敗を表示する', async () => {
    const empty = await mountPage();
    expect(empty.text()).toContain('まだ記録はありません');
    empty.unmount();
    mocks.list.mockRejectedValue(new Error('storage-denied'));
    const failed = await mountPage();
    expect(failed.get('[role="status"]').text()).toContain(
      '処理を完了できません',
    );
    failed.unmount();
  });
  it('画像付き詳細を選択し直すとURLを解放する', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const first = imageEntry();
    const second = createRecordFixture();
    second.record.drm = 'playready';
    second.record.mode = 'hardware';
    second.record.robustness = 'SL3000';
    second.record.environment.browserName = 'edge';
    second.record.captureMethod = '';
    mocks.list.mockResolvedValue([first, second]);
    const wrapper = await mountPage();
    await wrapper.findAll('.record-button')[0]!.trigger('click');
    expect(wrapper.get('.detail img').attributes('alt')).toBe(
      '検証スクリーンショット 1',
    );
    await wrapper.findAll('.record-button')[1]!.trigger('click');
    expect(revoke).toHaveBeenCalledOnce();
    expect(wrapper.get('.detail').text()).toContain('未確認');
    expect(wrapper.get('.detail').text()).toContain('PlayReady');
    expect(wrapper.get('.detail').text()).toContain('SL3000');
    expect(wrapper.get('.detail').text()).toContain('Edge');
    wrapper.unmount();
    revoke.mockRestore();
  });
  it('エクスポートと失敗を表示する', async () => {
    mocks.list.mockResolvedValue([createRecordFixture()]);
    const wrapper = await mountPage();
    await wrapper.get('.actions button').trigger('click');
    await flushPromises();
    expect(mocks.download).toHaveBeenCalledWith(
      expect.any(Blob),
      'veilframe-records.zip',
    );
    expect(wrapper.text()).toContain('エクスポートしました');
    mocks.exportRecords.mockRejectedValue(new Error('too-large'));
    await wrapper.get('.actions button').trigger('click');
    await flushPromises();
    expect(wrapper.get('[role="status"]').classes()).toContain('error');
    wrapper.unmount();
  });
  it('ZIPを検証して取り込み結果を表示する', async () => {
    const wrapper = await mountPage();
    await importFile(wrapper);
    expect(mocks.importAll).not.toHaveBeenCalled();
    await importFile(wrapper, new File(['zip'], 'records.zip'));
    expect(mocks.importAll).toHaveBeenCalledWith([]);
    expect(wrapper.text()).toContain('1件取り込み、2件');
    const large = new File(['zip'], 'huge.zip');
    Object.defineProperty(large, 'size', { value: 100 * 1024 * 1024 + 1 });
    await importFile(wrapper, large);
    expect(wrapper.text()).toContain('処理を完了できません');
    mocks.importRecords.mockImplementation(() => {
      throw new Error('invalid');
    });
    await importFile(wrapper, new File(['bad'], 'bad.zip'));
    expect(mocks.importAll).toHaveBeenCalledOnce();
    wrapper.unmount();
  });
  it('選択中の記録を確認して削除する', async () => {
    const entry = imageEntry();
    mocks.list.mockResolvedValueOnce([entry]).mockResolvedValue([]);
    const wrapper = await mountPage();
    await wrapper.get('.record-button').trigger('click');
    await wrapper.get('.record > button.danger').trigger('click');
    await wrapper.get('.dialog .actions button').trigger('click');
    expect(wrapper.find('[role="alertdialog"]').exists()).toBe(false);
    await wrapper.get('.record > button.danger').trigger('click');
    await wrapper.get('.dialog button.danger').trigger('click');
    await flushPromises();
    expect(mocks.remove).toHaveBeenCalledWith(entry.record.id);
    expect(wrapper.find('.detail').exists()).toBe(false);
    expect(wrapper.text()).toContain('削除しました');
    wrapper.unmount();
  });
  it('選択外の記録の削除では詳細を保持する', async () => {
    const first = createRecordFixture();
    const second = createRecordFixture();
    mocks.list
      .mockResolvedValueOnce([first, second])
      .mockResolvedValue([first]);
    const wrapper = await mountPage();
    await wrapper.findAll('.record-button')[0]!.trigger('click');
    await wrapper.findAll('.record > button.danger')[1]!.trigger('click');
    await wrapper.get('.dialog button.danger').trigger('click');
    await flushPromises();
    expect(wrapper.find('.detail').exists()).toBe(true);
    wrapper.unmount();
  });
  it('削除対象がない操作では保存内容を変更しない', async () => {
    const wrapper = await mountPage();
    const vm = wrapper.vm as unknown as { removeRecord(): Promise<void> };
    await vm.removeRecord();
    expect(mocks.remove).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
