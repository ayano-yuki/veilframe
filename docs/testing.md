# テストとPRスクリーンショットCI

## ローカルの必須検査

```sh
pnpm check
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

Vitest V8で`src/**/*.{ts,vue}`、`server/**/*.ts`、`app/**/*.vue`を対象に、行・文・関数・分岐100%を必須とする。未実行ファイルも対象にする。計測から明示的に除外するのはテストファイルと型宣言のみ。生成コード・依存・設定・開発スクリプト・CSSはアプリの実行コードの対象glob外。空の型専用モジュールに実行時の分岐があると見なさない。

レポートは`coverage/`。Happy DOMとfake-indexeddbを使い、Nuxt Test UtilsでSSRの入口・コンポーネントを検証する。実ブラウザのIndexedDB保存・再接続をPlaywrightで確認する。通常のCIは外部DRMへ通信しない。

ユニットテストはAPI・保存・ロードの成功だけでなく、容量超過、破損ZIP、許可外ID、重複、全体ロールバック、上流拒否、空応答、15秒中止、古い非同期処理、破棄失敗を検証する。テスト用実装は型契約に合わせ、実機の保護能力を模倣した結果として扱わない。

## UIテスト用再生

`VEILFRAME_UI_TEST=1`のローカル起動時、NuxtのaliasでShakaアダプターを`tests/support/create-test-player.ts`へ差し替える。Vercelではこの差し替えを有効にしない。テスト設定を通常の起動へ引き継がない。

Playwrightは1440×1000と412×915で3画面、一覧・詳細、削除確認、通常表示、再生状態、非対応とエラーを撮影する。時刻表示はAsia/Tokyo。画像は`test-results/`、HTMLレポートは`playwright-report/`。

## GitHub Actions

`ci.yml`はすべてのPR・pushで静的検査、型、整形、カバレッジ、本番ビルドを実行する。PRのUIジョブは変更ファイルのパスで撮影の要否を判定する。

撮影対象は`app/`、`src/`、`server/`、`public/`、`tests/`、`scripts/`、ワークフロー、Nuxt・Playwright・Vitest設定、architecture.json、package.json、ロックファイル、pnpmワークスペース、Node・npm設定、Vercel設定。名前変更前のパスも検査し、APIの取得上限に達した場合は撮影する。ドキュメントだけの変更は撮影しない。

日本語フォントをインストールし、画像とレポートを`ui-screenshots`成果物へ14日保存する。APIからの情報を使ってコメントする`ui-comment.yml`は`workflow_run`で起動し、PRコードをcheckout・実行せず、成果物もダウンロードしない。

投稿前に元ワークフロー・リポジトリ・成果物・PRの最新SHAを確認する。古い実行で新しいコミットのコメントを更新しない。`<!-- veilframe-ui -->`があるGitHub Actions botのコメントを更新するため、PRごとにコメントが増え続けない。Forkのテストジョブへ書き込み権限や秘密を渡さず、投稿ジョブだけにPR書き込み権限を与える。

リポジトリ指定後、両ワークフローを既定ブランチへ配置し、同一リポジトリとForkのPRで投稿、更新、期限付きリンク、UI非関連変更時のスキップを確認する。現時点ではGitHub上の実行・コメント投稿は未実施。
