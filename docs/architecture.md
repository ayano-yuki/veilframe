# 実装と静的検査

## 構成

```text
app/                 Nuxtのapp.vueと薄いルート
src/pages/           画面と画面への接続
src/features/        再生制御・下書き・ZIP交換
src/entities/        再生と記録の契約・実装
src/shared/          共通スキーマ・CSS・ダウンロード処理
server/api/          HTTPの入口
server/application/  要求の容量制限
server/domain/       転送契約・接続先の解決
server/infrastructure/ 外部HTTP転送
tests/support/       テスト専用補助
tests/e2e/           実ブラウザの操作と撮影
```

FSDのAppレイヤーの組み立てはNuxtの`app/`と設定が担当する。Widgetsは独立した複合部品が必要になった時に使い、空のスライスを作らない。画面間の機能を同一レイヤー参照で共有せず、下位へ切り出す。

## 公開入口

`architecture.json`の`publicFiles`がスライスの公開APIである。`@fsd/`は`src/`を指す。同一スライス内だけ相対import、その他のFSD参照はエイリアスから公開ファイルへ直接importする。`index.ts`等で複数モジュールを再エクスポートしない。

`RecordRepository`は保存・一覧・削除・原子的インポート・接続終了を定義し、`idb`実装を接続する。画像と記録を一つの値として保存するので削除・ロールバックが分離しない。

`PlaybackPort`はロードと破棄の契約。Shakaはクライアントで動的importする。再生制御は世代番号を使い、古い生成やロードの結果が新しい条件の表示を上書きしないようにする。Shakaエラー6001は要求構成非対応として扱う。

`LicenseTransport`は許可済み接続とバイナリからバイナリを返す契約。HTTP実装はリダイレクト拒否・15秒中止・応答ストリームの1 MiB上限を持つ。API入口でも要求をストリームで1 MiBまで読み、許可されないIDには転送しない。認証ヘッダーをブラウザから受け付けない。

## 状態とSSR

Piniaには検証記録の下書きだけを置く。プレイヤーや認証情報をSSRのシリアライズ対象にしない。IndexedDBはonMountedまたは保存操作後に生成する。独自接続の画面設定はページ内のrefで保持する。

動画URLの初期値もNuxtのサーバー専用runtime configで管理し、ローカル接続有効時だけAPIから返す。接続情報とライセンス応答のHTTPキャッシュを禁止する。

## 決定的な検査

`pnpm lint`はOxlintとTypeScript ASTを使った独自チェックを実行する。

| ルール                                                 | 強制する検査                           |
| ------------------------------------------------------ | -------------------------------------- |
| any・型抑制・eval・debugger・console・比較・重複import | Oxlint                                 |
| VueのPascalCase、その他のkebab-case                    | 独自チェック（Nuxt指定名は明示リスト） |
| 関数・変数のcamelCase、型のPascalCase                  | ASTの宣言名チェック                    |
| FSDの配置、Vueのuiセグメント、サーバーの責務別配置     | 独自チェック                           |
| 下位依存、同一レイヤー別スライス禁止、公開ファイル限定 | 独自チェック                           |
| 相対importとエイリアスの使い分け、循環依存             | 独自チェック                           |
| バレルエクスポート・動的importの変数指定               | 独自チェック                           |
| Shaka・idbの利用場所、ブラウザからserverへの依存       | 独自チェック                           |
| 未採用のlocalStorage・sessionStorage利用、検査抑制     | 独自チェック                           |
| テンプレートを含む型整合性                             | Nuxt typecheck / vue-tsc               |
| 表記と整形                                             | Prettier                               |

独自チェックはVueのscript部分を解析する。テンプレート内の命名やCSSセレクターをTypeScript ASTで検査したと主張しない。Nuxt固定名の例外と公開ファイルは`architecture.json`でレビューする。第三者ライブラリ内部の型定義をアプリ独自のanyとして書き換えない。
