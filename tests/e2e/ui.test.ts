import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createLegacyRecordFixture } from '../support/create-legacy-record-fixture';

async function screenshot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}
test('再生・記録・詳細・削除・接続設定', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    '見える映像、その先を確かめる。',
  );
  await expect(page.getByRole('button', { name: '再生を開始' })).toBeEnabled();
  await screenshot(page, info, 'playback-idle');
  await page.getByRole('button', { name: '再生を開始' }).click();
  await expect(page.getByRole('status').first()).toHaveText('再生中');
  await screenshot(page, info, 'playback-playing');
  await page.getByRole('radio', { name: 'ハードウェア保護' }).check();
  await expect(page.getByRole('status').first()).toHaveText('待機中');
  await page.getByRole('button', { name: '再生を開始' }).click();
  await page.getByLabel('OS', { exact: true }).fill('Windows 11');
  await page.getByLabel('端末名').fill('検証端末');
  await page.getByLabel('ブラウザの種類').selectOption('brave');
  await page.getByLabel('ブラウザのバージョン').fill('1.84');
  await page.getByLabel('映像部分の目視結果').selectOption('black');
  await page.getByLabel('キャプチャ方法').fill('標準キャプチャ');
  await page
    .getByLabel('メモ')
    .fill('UIテスト用記録。実際のDRM結果ではありません。');
  await page.getByRole('button', { name: '検証記録を保存' }).click();
  await expect(page.getByRole('status').last()).toHaveText(
    '記録をこのブラウザに保存しました。',
  );
  await page.getByRole('link', { name: '記録', exact: true }).click();
  await expect(page).toHaveURL(/\/records$/);
  await page.reload();
  await expect(page.getByRole('button', { name: /Sintel/ })).toBeVisible();
  await screenshot(page, info, 'records-list');
  await page.getByRole('button', { name: /Sintel/ }).click();
  await expect(page.getByRole('region', { name: '記録詳細' })).toBeVisible();
  await expect(page.getByRole('region', { name: '記録詳細' })).toContainText(
    'Brave',
  );
  await expect(page.getByRole('region', { name: '記録詳細' })).toContainText(
    '1.84',
  );
  await screenshot(page, info, 'record-detail');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'ZIPでエクスポート' }).click();
  expect((await download).suggestedFilename()).toBe('veilframe-records.zip');
  await page.getByRole('button', { name: '削除', exact: true }).click();
  await screenshot(page, info, 'delete-confirmation');
  await page.getByRole('button', { name: 'キャンセル' }).click();
  await expect(page.getByRole('alertdialog')).not.toBeVisible();
  await page.getByRole('button', { name: '削除', exact: true }).click();
  await page.getByRole('button', { name: '記録を削除', exact: true }).click();
  await expect(
    page.getByText('まだ記録はありません。', { exact: false }),
  ).toBeVisible();
  await page.getByRole('link', { name: '接続設定' }).click();
  await expect(
    page.getByText('Shaka 公開テスト', { exact: true }),
  ).toBeVisible();
  await screenshot(page, info, 'connections');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const state of ['failed', 'unsupported'] as const) {
  test(`再生状態 ${state}`, async ({ page }, info) => {
    await page.addInitScript((value) => {
      window.veilframeTestPlayback = value;
    }, state);
    await page.goto('/');
    await page.getByRole('button', { name: '再生を開始' }).click();
    await expect(page.getByRole('status').first()).toContainText(
      state === 'failed' ? '再生できませんでした' : '対応していません',
    );
    await screenshot(page, info, `playback-${state}`);
    await page.getByRole('button', { name: '検証記録を保存' }).click();
    await expect(page.getByRole('status').last()).toHaveText(
      '記録をこのブラウザに保存しました。',
    );
  });
}

test('公開接続情報には秘密とURLを含めない', async ({ request }) => {
  const response = await request.get('/api/connections');
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({
    localEnabled: false,
    connections: [
      { id: 'shaka-widevine', name: 'Shaka 公開テスト', drm: 'widevine' },
      {
        id: 'microsoft-playready',
        name: 'Microsoft PlayReady 公開テスト',
        drm: 'playready',
      },
    ],
  });
  expect(
    (await request.post('/api/license/arbitrary', { data: 'test' })).status(),
  ).toBe(404);
});

test('旧IndexedDB記録を再読み込み後も表示できる', async ({ page }) => {
  await page.goto('/records');
  await expect(
    page.getByText('まだ記録はありません。', { exact: false }),
  ).toBeVisible();
  const entry = createLegacyRecordFixture();
  entry.record.materialName = '旧形式の記録';
  await page.evaluate(
    async (legacy) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('veilframe-records', 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction('records', 'readwrite');
        transaction.objectStore('records').put(legacy);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
      database.close();
    },
    { ...entry, images: {} },
  );
  await page.reload();
  await page.getByRole('button', { name: /旧形式の記録/ }).click();
  await expect(page.getByRole('region', { name: '記録詳細' })).toContainText(
    '未確認 / 140',
  );
});

test('PlayReadyの手動選択とSL3000を記録する', async ({ page }, info) => {
  await page.goto('/');
  await page.getByLabel('DRM方式').selectOption('playready');
  await expect(page.getByLabel('素材')).toContainText('Tears of Steel');
  await page.getByRole('button', { name: '再生を開始' }).click();
  await expect(page.getByRole('status').first()).toHaveText('再生中');
  await screenshot(page, info, 'playready-normal');
  await page.getByRole('radio', { name: 'ハードウェア保護' }).check();
  await expect(page.getByRole('status').first()).toHaveText('待機中');
  await page.getByRole('button', { name: '再生を開始' }).click();
  await screenshot(page, info, 'playready-hardware');
  await page.getByLabel('ブラウザの種類').selectOption('edge');
  await page.getByLabel('OS', { exact: true }).fill('Windows 11');
  await page
    .getByLabel('メモ')
    .fill('UIテスト用のPlayReady記録。実機の結果ではありません。');
  await page.getByRole('button', { name: '検証記録を保存' }).click();
  await expect(page.getByRole('status').last()).toHaveText(
    '記録をこのブラウザに保存しました。',
  );
  await page.getByRole('link', { name: '記録', exact: true }).click();
  await page.getByRole('button', { name: /Tears of Steel/ }).click();
  await expect(page.getByRole('region', { name: '記録詳細' })).toContainText(
    'PlayReady',
  );
  await expect(page.getByRole('region', { name: '記録詳細' })).toContainText(
    'SL3000',
  );
  await expect(page.getByRole('region', { name: '記録詳細' })).toContainText(
    'Edge',
  );
  await screenshot(page, info, 'playready-record');
});
