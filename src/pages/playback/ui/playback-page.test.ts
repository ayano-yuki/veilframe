import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises } from '@vue/test-utils';
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { ref } from 'vue';
import PlaybackPage from './PlaybackPage.vue';
import type { StoredRecord } from '@fsd/entities/record/model/record-schema';

const mocks = vi.hoisted(() => ({
  data: {
    value: {
      localEnabled: true,
      connections: [{ id: 'shaka-widevine', name: 'Shaka 公開テスト' }],
    },
  } as {
    value:
      | { localEnabled: boolean; connections: { id: string; name: string }[] }
      | undefined;
  },
  error: { value: null as Error | null },
  load: vi.fn(),
  destroy: vi.fn(),
  save: vi.fn(),
  close: vi.fn(),
  create: vi.fn(),
}));
mockNuxtImport('useFetch', () => () => ({
  data: mocks.data,
  error: mocks.error,
}));
vi.mock('@fsd/entities/playback/api/create-shaka-player', () => ({
  createShakaPlayer: mocks.create,
}));
vi.mock('@fsd/entities/record/api/create-record-repository', () => ({
  createRecordRepository: () => ({ save: mocks.save, close: mocks.close }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.data = ref({
    localEnabled: true,
    connections: [{ id: 'shaka-widevine', name: 'Shaka 公開テスト' }],
  });
  mocks.error = ref(null);
  mocks.load.mockResolvedValue(undefined);
  mocks.destroy.mockResolvedValue(undefined);
  mocks.save.mockResolvedValue(undefined);
  mocks.close.mockResolvedValue(undefined);
  mocks.create.mockResolvedValue({ load: mocks.load, destroy: mocks.destroy });
});
async function start(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  await wrapper.get('.controls button.primary').trigger('click');
  await flushPromises();
}
async function save(wrapper: Awaited<ReturnType<typeof mountSuspended>>) {
  await wrapper.get('form').trigger('submit');
  await flushPromises();
}
async function attach(
  wrapper: Awaited<ReturnType<typeof mountSuspended>>,
  files: File[],
) {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, 'files', {
    value: files,
    configurable: true,
  });
  await input.trigger('change');
}

describe('再生・検証画面', () => {
  it('通常再生と画像付き保存を行い、URLを記録へ含めない', async () => {
    const wrapper = await mountSuspended(PlaybackPage);
    await start(wrapper);
    for (const input of wrapper.findAll('form input:not([type="file"])')) {
      await input.setValue('検証値');
    }
    await wrapper.get('form select').setValue('black');
    await wrapper.get('textarea').setValue('実機のメモ');
    expect(wrapper.get('[role="status"]').text()).toBe('再生中');
    await attach(wrapper, [
      new File(['png'], 'capture.png', { type: 'image/png' }),
    ]);
    expect(wrapper.findAll('li')).toHaveLength(1);
    await save(wrapper);
    const entry = mocks.save.mock.calls[0]![0] as StoredRecord;
    expect(entry.record.playback).toBe('playing');
    expect(entry.record.capability).toBe('supported');
    expect(entry.record.images).toHaveLength(1);
    expect(entry.record).not.toHaveProperty('manifestUrl');
    expect(wrapper.findAll('li')).toHaveLength(0);
    wrapper.unmount();
  });
  it('保護モードの変更で停止し、ハードウェア要件を保存する', async () => {
    const wrapper = await mountSuspended(PlaybackPage);
    await start(wrapper);
    await wrapper.get('input[value="hardware"]').setValue();
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toBe('待機中');
    await start(wrapper);
    await save(wrapper);
    expect(
      (mocks.save.mock.calls[0]![0] as StoredRecord).record.robustness,
    ).toBe('HW_SECURE_ALL');
    await wrapper.get('input[value="normal"]').setValue();
    await flushPromises();
    wrapper.unmount();
  });
  it.each(['unsupported', 'license-failed'])(
    '失敗も保存できる %s',
    async (error) => {
      mocks.create.mockRejectedValue(new Error(error));
      const wrapper = await mountSuspended(PlaybackPage);
      await start(wrapper);
      await save(wrapper);
      const record = (mocks.save.mock.calls[0]![0] as StoredRecord).record;
      expect(record.playback).toBe('failed');
      expect(record.capability).toBe(
        error === 'unsupported' ? 'unsupported' : 'unknown',
      );
      wrapper.unmount();
    },
  );
  it('再生前の未確認結果を保存できる', async () => {
    const wrapper = await mountSuspended(PlaybackPage);
    await save(wrapper);
    expect((mocks.save.mock.calls[0]![0] as StoredRecord).record.playback).toBe(
      'idle',
    );
    wrapper.unmount();
  });
  it('接続先の取得失敗では操作を止める', async () => {
    mocks.error = ref(new Error('failed'));
    const wrapper = await mountSuspended(PlaybackPage);
    expect(
      wrapper.get('.controls button.primary').attributes('disabled'),
    ).toBeDefined();
    expect(wrapper.get('[role="alert"]').text()).toContain('読み込めません');
    wrapper.unmount();
  });
  it('独自素材のURLを検証して許可された接続へ送る', async () => {
    const wrapper = await mountSuspended(PlaybackPage);
    await wrapper.get('select').setValue('custom');
    await wrapper
      .get('.controls input:not([type="url"]):not([type="radio"])')
      .setValue('独自素材');
    await wrapper.findAll('.controls select')[1]!.setValue('shaka-widevine');
    for (const value of [
      '',
      'http://example.test/video',
      'https://user:password@example.test/video',
    ]) {
      await wrapper.get('input[type="url"]').setValue(value);
      await start(wrapper);
      expect(wrapper.text()).toContain('HTTPSのURL');
    }
    await wrapper
      .get('input[type="url"]')
      .setValue('https://example.test/video?token=private');
    await start(wrapper);
    await save(wrapper);
    expect(mocks.load).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        manifestUrl: 'https://example.test/video?token=private',
      }),
    );
    expect(
      (mocks.save.mock.calls[0]![0] as StoredRecord).record.materialName,
    ).toBe('独自素材');
    wrapper.unmount();
  });
  it('公開環境では独自素材を選択できない', async () => {
    mocks.data.value = { localEnabled: false, connections: [] };
    const wrapper = await mountSuspended(PlaybackPage);
    expect(wrapper.find('option[value="custom"]').exists()).toBe(false);
    await start(wrapper);
    expect(wrapper.text()).toContain('接続先を選択');
    await save(wrapper);
    expect(
      (mocks.save.mock.calls[0]![0] as StoredRecord).record.connectionName,
    ).toBe('不明');
    wrapper.unmount();
  });
  it('接続情報がない状態も扱う', async () => {
    mocks.data.value = undefined;
    const wrapper = await mountSuspended(PlaybackPage);
    await start(wrapper);
    expect(wrapper.text()).toContain('接続先を選択');
    wrapper.unmount();
  });
  it('画像の形式・サイズ・枚数を検証して取り除ける', async () => {
    const wrapper = await mountSuspended(PlaybackPage);
    for (const files of [
      [new File([], 'empty.png', { type: 'image/png' })],
      [new File(['x'], 'bad.svg', { type: 'image/svg+xml' })],
      Array.from(
        { length: 6 },
        () => new File(['x'], 'image.png', { type: 'image/png' }),
      ),
    ]) {
      await attach(wrapper, files);
      expect(wrapper.text()).toContain('1枚10MB');
    }
    const large = new File(['x'], 'large.png', { type: 'image/png' });
    Object.defineProperty(large, 'size', { value: 10 * 1024 * 1024 + 1 });
    await attach(wrapper, [large]);
    await attach(wrapper, [
      new File(['jpg'], 'valid.jpg', { type: 'image/jpeg' }),
    ]);
    await wrapper.get('li button').trigger('click');
    expect(wrapper.findAll('li')).toHaveLength(0);
    await attach(wrapper, []);
    wrapper.unmount();
  });
  it('ファイル選択をキャンセルした場合は添付を変えない', async () => {
    const wrapper = await mountSuspended(PlaybackPage);
    const input = wrapper.get('input[type="file"]');
    Object.defineProperty(input.element, 'files', {
      value: null,
      configurable: true,
    });
    await input.trigger('change');
    expect(wrapper.findAll('li')).toHaveLength(0);
    wrapper.unmount();
  });
  it('保存・終了処理の失敗を扱う', async () => {
    const wrapper = await mountSuspended(PlaybackPage);
    mocks.save.mockRejectedValue(new Error('quota'));
    mocks.close.mockRejectedValue(new Error('closed'));
    await save(wrapper);
    expect(wrapper.text()).toContain('保存できません');
    await start(wrapper);
    mocks.destroy.mockRejectedValue(new Error('destroy'));
    await wrapper.get('input[value="hardware"]').setValue();
    await flushPromises();
    expect(wrapper.text()).toContain('終了処理に失敗');
    await start(wrapper);
    wrapper.unmount();
    await flushPromises();
  });
});
