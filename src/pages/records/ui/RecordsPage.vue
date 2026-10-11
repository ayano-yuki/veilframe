<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { createRecordRepository } from '@fsd/entities/record/api/create-record-repository';
import type { RecordRepository } from '@fsd/entities/record/api/record-repository';
import type { StoredRecord } from '@fsd/entities/record/model/record-schema';
import { archiveLimit } from '@fsd/entities/record/model/record-schema';
import {
  exportRecords,
  importRecords,
} from '@fsd/features/transfer-records/model/record-archive';
import { downloadBlob } from '@fsd/shared/lib/download-blob';

const entries = ref<StoredRecord[]>([]);
const selected = ref<StoredRecord>();
const imageUrls = ref<string[]>([]);
const message = ref('');
const failed = ref(false);
const busy = ref(true);
const pendingDelete = ref<string>();
let repository: RecordRepository | undefined;

function clearImages() {
  for (const url of imageUrls.value) {
    URL.revokeObjectURL(url);
  }
  imageUrls.value = [];
}
function selectEntry(entry: StoredRecord) {
  clearImages();
  selected.value = entry;
  imageUrls.value = entry.record.images.map((image) =>
    URL.createObjectURL(entry.images[image.id]!),
  );
}
async function perform(action: () => Promise<void>) {
  busy.value = true;
  failed.value = false;
  message.value = '';
  try {
    await action();
  } catch {
    failed.value = true;
    message.value =
      '処理を完了できませんでした。ファイルの形式・容量とブラウザの保存設定を確認してください。';
  } finally {
    busy.value = false;
  }
}
onMounted(() => {
  void perform(async () => {
    repository = createRecordRepository();
    entries.value = await repository.list();
  });
});
onUnmounted(() => {
  clearImages();
  void repository?.close();
});
async function exportAll() {
  await perform(async () => {
    const bytes = await exportRecords(entries.value);
    downloadBlob(
      new Blob([new Uint8Array(bytes)], { type: 'application/zip' }),
      'veilframe-records.zip',
    );
    message.value = 'エクスポートしました。';
  });
}
async function importFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) {
    return;
  }
  await perform(async () => {
    if (file.size > archiveLimit || !repository) {
      throw new Error('invalid-import');
    }
    const incoming = importRecords(new Uint8Array(await file.arrayBuffer()));
    const result = await repository.importAll(incoming);
    entries.value = await repository.list();
    message.value = `${result.imported}件取り込み、${result.skipped}件の重複をスキップしました。`;
  });
  input.value = '';
}
async function removeRecord() {
  const id = pendingDelete.value;
  if (!id || !repository) {
    return;
  }
  await perform(async () => {
    await repository!.remove(id);
    entries.value = await repository!.list();
    if (selected.value?.record.id === id) {
      selected.value = undefined;
      clearImages();
    }
    pendingDelete.value = undefined;
    message.value = '記録と添付画像を削除しました。';
  });
}
const observations = {
  visible: '映像が写る',
  black: '黒くなる',
  other: 'その他',
  unchecked: '未確認',
};
</script>
<template>
  <p class="eyebrow">02 / field notes</p>
  <h1>検証記録</h1>
  <p class="muted">このブラウザに保存した記録。ZIPで別の端末へ持ち出せます。</p>
  <div class="actions section">
    <button :disabled="busy || !entries.length" @click="exportAll">
      ZIPでエクスポート
    </button>
    <label class="import"
      >ZIPをインポート<input
        type="file"
        accept=".zip,application/zip"
        :disabled="busy"
        @change="importFile"
    /></label>
  </div>
  <p v-if="message" class="message" :class="{ error: failed }" role="status">
    {{ message }}
  </p>
  <p v-if="busy" role="status">処理中…</p>
  <p v-else-if="!entries.length" class="muted empty">
    まだ記録はありません。再生・検証画面で結果を保存してください。
  </p>
  <div class="records">
    <section aria-label="記録一覧">
      <article v-for="entry in entries" :key="entry.record.id" class="record">
        <button class="record-button" @click="selectEntry(entry)">
          <strong>{{ entry.record.materialName }}</strong
          ><span>{{
            new Date(entry.record.createdAt).toLocaleString('ja-JP', {
              timeZone: 'Asia/Tokyo',
            })
          }}</span
          ><span
            >{{
              entry.record.mode === 'hardware' ? 'ハードウェア保護' : '通常DRM'
            }}
            / {{ observations[entry.record.observation] }}</span
          >
        </button>
        <button class="danger" @click="pendingDelete = entry.record.id">
          削除
        </button>
      </article>
    </section>
    <section v-if="selected" class="detail" aria-label="記録詳細">
      <h2>{{ selected.record.materialName }}</h2>
      <dl>
        <dt>接続先</dt>
        <dd>{{ selected.record.connectionName }}</dd>
        <dt>再生結果</dt>
        <dd>{{ selected.record.playback }}</dd>
        <dt>対応確認</dt>
        <dd>{{ selected.record.capability }}</dd>
        <dt>要求保護要件</dt>
        <dd>{{ selected.record.robustness }}</dd>
        <dt>環境</dt>
        <dd>
          {{ selected.record.environment.os }} /
          {{ selected.record.environment.chrome }} /
          {{ selected.record.environment.device }}
        </dd>
        <dt>ブラウザ情報</dt>
        <dd>{{ selected.record.environment.browser }}</dd>
        <dt>キャプチャ方法</dt>
        <dd>{{ selected.record.captureMethod || '未確認' }}</dd>
        <dt>目視結果</dt>
        <dd>{{ observations[selected.record.observation] }}</dd>
      </dl>
      <p class="memo">{{ selected.record.memo }}</p>
      <img
        v-for="(url, index) in imageUrls"
        :key="url"
        :src="url"
        :alt="`検証スクリーンショット ${index + 1}`"
      />
    </section>
  </div>
  <div v-if="pendingDelete" class="backdrop">
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      class="dialog"
    >
      <h2 id="delete-title">記録を削除しますか？</h2>
      <p class="muted">添付画像も削除されます。この操作は元に戻せません。</p>
      <div class="actions">
        <button autofocus :disabled="busy" @click="pendingDelete = undefined">
          キャンセル</button
        ><button class="danger" :disabled="busy" @click="removeRecord">
          記録を削除
        </button>
      </div>
    </section>
  </div>
</template>
<style scoped>
.import {
  display: flex;
  align-items: center;
  gap: 12px;
}
.import input {
  width: auto;
  max-width: 240px;
}
.empty {
  padding: 50px 0;
}
.records {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}
.record {
  display: flex;
  align-items: center;
  gap: 12px;
  border-bottom: 1px solid var(--line);
  padding: 18px 0;
}
.record-button {
  display: grid;
  flex: 1;
  gap: 10px;
  border: 0;
  padding: 0;
  background: transparent;
  text-align: left;
}
.record-button span {
  font-size: 0.8rem;
  color: var(--muted);
}
.detail {
  padding-top: 24px;
}
.detail img {
  width: 100%;
  margin-top: 16px;
}
.detail dd {
  margin: 6px 0 16px;
  overflow-wrap: anywhere;
}
.detail dt {
  color: var(--muted);
  font-size: 0.8rem;
}
.memo {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.backdrop {
  position: fixed;
  inset: 0;
  background: #000b;
  display: grid;
  place-items: center;
  padding: 20px;
}
.dialog {
  max-width: 500px;
  padding: 32px;
  border: 1px solid var(--line);
  background: var(--surface);
}
@media (max-width: 750px) {
  .records {
    grid-template-columns: 1fr;
  }
  .import {
    flex-wrap: wrap;
  }
}
</style>
