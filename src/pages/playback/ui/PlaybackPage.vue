<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useFetch } from '#imports';
import { createShakaPlayer } from '@fsd/entities/playback/api/create-shaka-player';
import type {
  PlaybackMode,
  PlaybackState,
} from '@fsd/entities/playback/model/playback-port';
import { createRecordRepository } from '@fsd/entities/record/api/create-record-repository';
import {
  imageLimit,
  imageTypes,
  type ImageDescriptor,
} from '@fsd/entities/record/model/record-schema';
import { createPlaybackController } from '@fsd/features/play-media/model/create-playback-controller';
import { useCaptureDraft } from '@fsd/features/record-capture/model/use-capture-draft';

const { data, error: connectionsError } = await useFetch('/api/connections');
const draft = useCaptureDraft();
const mode = ref<PlaybackMode>('normal');
const material = ref('sintel');
const manifestUrl = ref(data.value?.defaults?.manifestUrl ?? '');
const connectionId = ref(
  data.value?.defaults?.connectionId || 'shaka-widevine',
);
const materialName = ref('独自素材');
const video = ref<HTMLVideoElement>();
const state = ref<PlaybackState>('idle');
const message = ref('');
const browser = ref('不明');
const saving = ref(false);
const ready = ref(false);
const attachments = ref<Array<{ descriptor: ImageDescriptor; blob: Blob }>>([]);
const controller = createPlaybackController(createShakaPlayer, (value) => {
  state.value = value;
});
const states: Record<PlaybackState, string> = {
  idle: '待機中',
  loading: '再生を準備しています',
  playing: '再生中',
  failed: '再生できませんでした。接続・素材・端末の対応を確認してください。',
  unsupported: 'この環境は要求する再生条件に対応していません。',
};
const isCustom = computed(
  () => material.value === 'custom' && data.value?.localEnabled,
);
const name = computed(() =>
  isCustom.value ? materialName.value : 'Sintel / Widevine',
);
const connection = computed(() =>
  data.value?.connections.find(
    (item) =>
      item.id === (isCustom.value ? connectionId.value : 'shaka-widevine'),
  ),
);
watch([mode, material, manifestUrl, connectionId], () => {
  void controller.reset().catch(() => {
    message.value =
      'プレイヤーの終了処理に失敗しました。ページを再読み込みしてください。';
  });
});
onMounted(() => {
  browser.value = navigator.userAgent;
  ready.value = true;
});
onUnmounted(() => {
  void controller.reset().catch(() => undefined);
});
async function startPlayback() {
  message.value = '';
  if (!video.value || !connection.value) {
    message.value = '接続先を選択してください。';
    return;
  }
  let url =
    'https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd';
  if (isCustom.value) {
    try {
      const parsed = new URL(manifestUrl.value);
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
        throw new Error('invalid-url');
      }
      url = parsed.href;
    } catch {
      message.value =
        '動画URLには認証情報を含まないHTTPSのURLを指定してください。';
      return;
    }
  }
  await controller.start(video.value, {
    manifestUrl: url,
    licenseUrl: `/api/license/${connection.value.id}`,
    mode: mode.value,
    serverCertificateUrl: isCustom.value
      ? ''
      : 'https://cwip-shaka-proxy.appspot.com/service-cert',
  });
}
function attachImages(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files ?? []);
  input.value = '';
  if (
    attachments.value.length + files.length > 5 ||
    files.some(
      (file) =>
        file.size === 0 ||
        file.size > imageLimit ||
        !imageTypes.some((type) => type === file.type),
    )
  ) {
    message.value = 'PNG・JPEG・WebPを1枚10MB、合計5枚以内で選択してください。';
    return;
  }
  attachments.value.push(
    ...files.map((file) => ({
      descriptor: {
        id: crypto.randomUUID(),
        size: file.size,
        type: file.type as ImageDescriptor['type'],
      },
      blob: file,
    })),
  );
  message.value = '';
}
async function saveRecord() {
  saving.value = true;
  message.value = '';
  const repository = createRecordRepository();
  try {
    await repository.save({
      record: {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        materialName: name.value,
        connectionName: connection.value?.name ?? '不明',
        mode: mode.value,
        robustness: mode.value === 'hardware' ? 'HW_SECURE_ALL' : 'default',
        capability:
          state.value === 'playing'
            ? 'supported'
            : state.value === 'unsupported'
              ? 'unsupported'
              : 'unknown',
        playback:
          state.value === 'playing'
            ? 'playing'
            : state.value === 'failed' || state.value === 'unsupported'
              ? 'failed'
              : 'idle',
        environment: {
          os: draft.os,
          browserName: draft.browserName,
          browserVersion: draft.browserVersion,
          device: draft.device,
          browser: browser.value,
        },
        captureMethod: draft.captureMethod,
        observation: draft.observation,
        memo: draft.memo,
        images: attachments.value.map((entry) => entry.descriptor),
      },
      images: Object.fromEntries(
        attachments.value.map((entry) => [entry.descriptor.id, entry.blob]),
      ),
    });
    message.value = '記録をこのブラウザに保存しました。';
    attachments.value = [];
  } catch {
    message.value =
      '記録を保存できませんでした。入力内容とブラウザの保存容量を確認してください。';
  } finally {
    await repository.close().catch(() => undefined);
    saving.value = false;
  }
}
</script>
<template>
  <div class="title-row">
    <div>
      <p class="eyebrow">01 / playback experiment</p>
      <h1>見える映像、その先を確かめる。</h1>
    </div>
    <span class="protocol">WIDEVINE / CHROME + BRAVE</span>
  </div>
  <div class="workspace">
    <section class="player-area" aria-label="動画プレイヤー">
      <div class="screen">
        <video
          ref="video"
          controls
          playsinline
          preload="none"
          aria-label="検証用動画"
        />
        <div v-if="state === 'idle'" class="screen-label">
          <span class="frame-mark">VF</span
          ><span>PROTECTED MEDIA EXPERIMENT</span
          ><small>素材と条件を選び、再生を開始してください。</small>
        </div>
      </div>
      <div class="status-bar">
        <span
          class="status-dot"
          :class="{ active: state === 'playing' }"
        /><span role="status">{{ states[state] }}</span
        ><span class="mode-tag">{{
          mode === 'hardware' ? 'HW_SECURE_ALL' : 'DEFAULT'
        }}</span>
      </div>
      <p class="muted disclaimer">
        画面キャプチャの結果はOS・端末・ブラウザに依存します。再生の成功だけでは、キャプチャ時の黒画面化を確認できません。
      </p>
      <p class="muted small">
        Sintel © Blender Foundation —
        <a
          href="https://durian.blender.org/about/"
          target="_blank"
          rel="noopener noreferrer"
          >CC BY 3.0 / 素材情報</a
        >
        · Shaka Player公開テスト素材
      </p>
    </section>
    <aside class="controls" aria-label="再生条件">
      <h2>再生条件</h2>
      <label
        >素材<select v-model="material">
          <option value="sintel">Sintel / Widevine</option>
          <option v-if="data?.localEnabled" value="custom">独自素材</option>
        </select></label
      >
      <template v-if="isCustom"
        ><label>素材名<input v-model="materialName" maxlength="200" /></label
        ><label
          >動画URL<input
            v-model="manifestUrl"
            type="url"
            autocomplete="off" /></label
        ><label
          >接続先<select v-model="connectionId">
            <option
              v-for="item in data?.connections"
              :key="item.id"
              :value="item.id"
            >
              {{ item.name }}
            </option>
          </select></label
        ></template
      >
      <fieldset>
        <legend>保護要件</legend>
        <label class="radio"
          ><input v-model="mode" type="radio" value="normal" />通常DRM<span
            >端末の既定の保護条件</span
          ></label
        ><label class="radio"
          ><input
            v-model="mode"
            type="radio"
            value="hardware"
          />ハードウェア保護<span>映像・音声にHW_SECURE_ALL</span></label
        >
      </fieldset>
      <button
        class="primary"
        :disabled="!ready || state === 'loading' || !!connectionsError"
        @click="startPlayback"
      >
        {{ state === 'loading' ? '準備中…' : '再生を開始' }}
      </button>
      <p v-if="connectionsError" class="message error" role="alert">
        接続先を読み込めませんでした。
      </p>
      <p class="muted small">
        条件の変更で再生を停止します。保護要件を満たせない場合、要件を緩めずに失敗を表示します。
      </p>
    </aside>
  </div>
  <section class="section capture">
    <div>
      <p class="eyebrow">capture observation</p>
      <h2>実機の結果を残す</h2>
      <p class="muted">
        Windows・Androidの標準機能で撮影し、映像部分の写り方を記録してください。
      </p>
    </div>
    <form @submit.prevent="saveRecord">
      <div class="fields">
        <label
          >OS<input
            v-model="draft.os"
            maxlength="200"
            placeholder="例：Windows 11 / Android 15" /></label
        ><label
          >ブラウザの種類<select v-model="draft.browserName">
            <option value="unknown">未確認</option>
            <option value="chrome">Chrome</option>
            <option value="brave">Brave</option>
          </select></label
        ><label
          >ブラウザのバージョン<input
            v-model="draft.browserVersion"
            maxlength="200"
            placeholder="不明な場合は空欄" /></label
        ><label>端末名<input v-model="draft.device" maxlength="200" /></label
        ><label
          >キャプチャ方法<input
            v-model="draft.captureMethod"
            maxlength="200"
            placeholder="例：Win + Shift + S" /></label
        ><label
          >映像部分の目視結果<select v-model="draft.observation">
            <option value="unchecked">未確認</option>
            <option value="visible">映像が写る</option>
            <option value="black">黒くなる</option>
            <option value="other">その他</option>
          </select></label
        ><label
          >スクリーンショット<input
            type="file"
            multiple
            accept="image/png,image/jpeg,image/webp"
            @change="attachImages"
        /></label>
      </div>
      <ul v-if="attachments.length">
        <li v-for="(entry, index) in attachments" :key="entry.descriptor.id">
          画像 {{ index + 1 }} /
          {{ (entry.descriptor.size / 1024).toFixed(0) }} KB
          <button type="button" @click="attachments.splice(index, 1)">
            取り除く
          </button>
        </li>
      </ul>
      <label class="memo"
        >メモ<textarea v-model="draft.memo" maxlength="5000" />
      </label>
      <p class="muted small">
        Braveでは設定からWidevineを有効にしてください。
        <a
          href="https://support.brave.app/hc/en-us/articles/360023851591-How-do-I-view-DRM-protected-content"
          >Windowsの手順</a
        >
        /
        <a
          href="https://support.brave.app/hc/en-us/articles/17428756610061-How-do-I-enable-Widevine-DRM-on-Android"
          >Androidの手順</a
        >
      </p>
      <p class="muted small">
        ブラウザ情報：{{ browser
        }}<br />動画URL・ライセンス認証情報は記録に含めません。
      </p>
      <button
        type="submit"
        class="primary"
        :disabled="!ready || saving || state === 'loading'"
      >
        {{ saving ? '保存中…' : '検証記録を保存' }}
      </button>
    </form>
  </section>
  <p v-if="message" class="message" role="status">{{ message }}</p>
</template>
<style scoped>
.title-row {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: flex-end;
  margin-bottom: 28px;
}
.title-row h1 {
  margin-bottom: 0;
}
.protocol {
  white-space: nowrap;
  color: var(--muted);
  font: 0.7rem monospace;
  letter-spacing: 0.1em;
  padding-bottom: 7px;
}
.workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 32px;
}
.screen {
  background: #070808;
  aspect-ratio: 16/9;
  position: relative;
  border: 1px solid #282c2b;
}
.screen video {
  width: 100%;
  height: 100%;
}
.screen-label {
  position: absolute;
  inset: 0 0 45px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 22px;
  pointer-events: none;
  font: 0.65rem monospace;
  letter-spacing: 0.12em;
  color: var(--muted);
}
.frame-mark {
  font:
    4.5rem Georgia,
    serif;
  color: #606b5c;
  letter-spacing: -0.08em;
}
.screen-label small {
  font-family: sans-serif;
  letter-spacing: 0;
}
.status-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 0;
  border-bottom: 1px solid var(--line);
  font-size: 0.8rem;
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--muted);
  flex-shrink: 0;
}
.status-dot.active {
  background: var(--accent);
}
.mode-tag {
  margin-left: auto;
  font: 0.65rem monospace;
  color: var(--muted);
}
.disclaimer {
  font-size: 0.8rem;
  margin-top: 14px;
}
.controls {
  display: grid;
  gap: 20px;
  align-content: start;
}
.controls h2 {
  margin-bottom: 0;
}
fieldset {
  margin: 0;
  padding: 0;
  border: 0;
  display: grid;
  gap: 12px;
}
legend {
  color: var(--muted);
  font-size: 0.9rem;
  margin-bottom: 12px;
}
.radio {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 8px;
  color: var(--text);
  padding: 12px 0;
  border-bottom: 1px solid var(--line);
}
.radio input {
  width: auto;
  margin: 2px 0;
  accent-color: var(--accent);
}
.radio span {
  grid-column: 2;
  font-size: 0.75rem;
  color: var(--muted);
}
.small {
  font-size: 0.75rem;
  overflow-wrap: anywhere;
}
.capture {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  gap: 32px;
  margin-top: 30px;
}
.memo {
  margin-top: 20px;
}
ul {
  padding-left: 20px;
}
li {
  padding: 8px 0;
}
li button {
  margin-left: 12px;
  padding: 4px 8px;
}
@media (max-width: 950px) {
  .workspace {
    grid-template-columns: 1fr;
  }
  .controls {
    grid-template-columns: 1fr 1fr;
  }
  .controls h2,
  .controls fieldset,
  .controls .small {
    grid-column: 1/-1;
  }
  .capture {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .protocol {
    display: none;
  }
}
@media (max-width: 650px) {
  .controls {
    grid-template-columns: 1fr;
  }
  .title-row h1 {
    font-size: 1.65rem;
  }
  .status-bar {
    align-items: flex-start;
  }
  .frame-mark {
    font-size: 3rem;
  }
  .screen-label {
    gap: 12px;
  }
  .mode-tag {
    white-space: nowrap;
  }
}
</style>
