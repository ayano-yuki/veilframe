<script setup lang="ts">
import { useFetch } from '#imports';
const { data, error } = await useFetch('/api/connections');
</script>
<template>
  <p class="eyebrow">03 / connections</p>
  <h1>接続設定</h1>
  <p class="muted">ライセンスの取得先を確認します。</p>
  <p v-if="error" class="message error" role="alert">
    接続設定を読み込めませんでした。
  </p>
  <section v-else class="section">
    <h2>許可済みの接続先</h2>
    <dl v-for="connection in data?.connections" :key="connection.id">
      <dt>{{ connection.name }}</dt>
      <dd>{{ connection.id }}</dd>
    </dl>
    <p v-if="data?.localEnabled" class="muted">
      独自接続が有効です。再生画面で動画URLと接続先を選択できます。認証情報はサーバー側で管理されます。
    </p>
    <p v-else class="muted">この環境では公開テスト素材を利用できます。</p>
  </section>
</template>
<style scoped>
dl {
  display: flex;
  justify-content: space-between;
  max-width: 700px;
  padding: 20px 0;
  border-bottom: 1px solid var(--line);
  gap: 20px;
}
dd {
  color: var(--muted);
  margin: 0;
  font-family: monospace;
}
</style>
