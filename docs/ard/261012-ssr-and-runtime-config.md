# SSRと環境設定の配信境界

状態：採用。SSRとサーバー専用runtime configは利用者と合意済み。

## 決定

NuxtでSSRし、動画再生とIndexedDBをクライアントで実行する。独自動画URLの初期値もサーバー専用設定とし、ローカル接続が有効な環境だけでAPIから配信する。SSR直後はクライアント準備まで操作を無効にする。

## 理由と代替案

全画面SPAよりもSSRとブラウザAPIの境界をテストする構成を選択した。公開runtime configはブラウザへシリアライズされるため、Vercelに設定が残ってもローカル用URLを配信しない設計とする。

## 影響

初期値の環境変数はNUXT_DEFAULT_MANIFEST_URLとNUXT_DEFAULT_CONNECTION_IDであり、NUXT_PUBLIC_へ秘密や独自設定を置かない。公開環境のAPIと画面の両方を検証する。
