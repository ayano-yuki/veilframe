# veilframe 開発ルール

## 利用者との合意

`docs/decisions.md`と`docs/ard/`を読む。未確定の仕様・新規ライブラリの採用はGrill-me形式で一問ずつ確認する。合意済みの事項を再確認しない。Vercelへの公開、GitHubへの接続、PR作成は現時点で未実施。

## コードの境界

- Nuxtを使い、FSDの上位から下位への依存を守る。ルートは薄くする。
- スライスの公開ファイルを明示する。バレルエクスポートは禁止。同一スライス内は相対import、越境参照はエイリアスを使う。
- 同一レイヤーの別スライス依存・非公開ファイルの越境参照・サーバーからブラウザ専用実装への依存を禁止する。
- 自動importを無効にし、APIを明示的にimportする。
- VueファイルはPascalCase、それ以外はkebab-case。関数・変数はcamelCase、型・インターフェイスはPascalCase。フレームワーク指定名の例外は文書化する。
- TypeScript strict。anyと型チェック抑制は原則禁止。外部入力はZodで検証する。
- SSR時に動画・IndexedDBなどのブラウザAPIを実行しない。
- 独自ライセンス接続はローカル限定。秘密情報・動画URLを記録やエクスポートへ含めない。

## 変更の検証

Oxlint、独自静的チェック、型チェック、Prettier、テストを実行する。アプリ実装の行・文・関数・分岐100%を必須とし、未達を除外設定やテスト抑制で隠さない。実機DRM結果とUIテスト結果を区別する。

設計判断は`docs/ard/YYMMDD-kebab-case.md`に保存する。日付は利用者のAsia/Tokyoを使う。通常の仕様・手順・検証結果はその他のdocsに置く。

インターフェイス変更・UI変更の検証では`skills/veilframe-review/SKILL.md`を読む。
