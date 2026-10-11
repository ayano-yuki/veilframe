# veilframe

Windows・AndroidのChrome・Braveで、Widevineの通常再生とハードウェア保護要求を比較するNuxtアプリです。実機で撮影した画像と検証結果をブラウザ内に保存できます。

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm dev
```

Node.jsは`.node-version`、pnpmは`package.json`の指定に合わせます。

- [仕様と操作](docs/specification.md)
- [実装と静的検査](docs/architecture.md)
- [ローカルHTTPS・実機検証・Vercel](docs/operations.md)
- [テストとPRスクリーンショットCI](docs/testing.md)
- [インターフェイスレビュー](docs/interface-review.md)
- [ローカル検証結果](docs/verification.md)
- [合意事項](docs/decisions.md) / [設計判断](docs/ard/)

```sh
pnpm check
pnpm build
pnpm exec playwright install --with-deps chromium
pnpm test:e2e
```

UIテストの再生はテスト用実装です。実際のDRM再生・キャプチャ結果は実機で検証します。
