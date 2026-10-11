<script setup lang="ts">
import { NuxtPage, NuxtLink } from '#components';
</script>

<template>
  <div class="shell">
    <header>
      <NuxtLink to="/" class="brand"
        >veilframe<span> / media lab</span></NuxtLink
      >
      <nav aria-label="メインナビゲーション">
        <NuxtLink to="/">再生・検証</NuxtLink>
        <NuxtLink to="/records">記録</NuxtLink>
        <NuxtLink to="/connections">接続設定</NuxtLink>
      </nav>
    </header>
    <main><NuxtPage /></main>
    <footer><span>veilframe</span><span>DRM / EME / CAPTURE</span></footer>
  </div>
</template>

<style scoped>
.shell {
  max-width: 1320px;
  margin: auto;
  padding: 0 40px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 24px;
  padding: 30px 0;
  border-bottom: 1px solid var(--line);
}
.brand {
  font-size: 1.4rem;
  font-weight: 600;
  letter-spacing: -0.05em;
  text-decoration: none;
}
.brand span {
  font-size: 0.8rem;
  font-weight: 400;
  color: var(--muted);
  letter-spacing: 0;
}
nav {
  display: flex;
  gap: 28px;
  font-size: 0.9rem;
}
nav a {
  text-decoration: none;
  color: var(--muted);
}
nav a.router-link-exact-active {
  color: var(--accent);
}
main {
  min-height: 70vh;
  padding: 40px 0 60px;
}
footer {
  display: flex;
  justify-content: space-between;
  padding: 24px 0;
  border-top: 1px solid var(--line);
  font-size: 0.7rem;
  letter-spacing: 0.1em;
  color: var(--muted);
}
@media (max-width: 650px) {
  .shell {
    padding: 0 20px;
  }
  header {
    align-items: flex-start;
    flex-direction: column;
    padding: 24px 0;
    gap: 20px;
  }
  nav {
    gap: 24px;
  }
  main {
    padding-top: 28px;
  }
}
</style>
