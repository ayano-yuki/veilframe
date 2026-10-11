# ローカルHTTPS・実機検証・Vercel

## ローカル

Node.js 24.16.0、pnpm 11.9.0を使用する。依存は正確なバージョンとロックファイルで管理する。TypeScriptはNuxtが使用する6.0.3、h3はNitroと一致する1.15.11に合わせる。

`.env.example`を`.env`へコピーする。公開素材だけなら追加設定は不要。

```dotenv
NUXT_LOCAL_CONNECTIONS_ENABLED=true
NUXT_CONNECTIONS_JSON=[{"id":"my-license","name":"独自検証","url":"https://license.example.com/widevine","headers":{"Authorization":"Bearer YOUR_TOKEN"}}]
NUXT_DEFAULT_MANIFEST_URL=https://media.example.com/test.mpd
NUXT_DEFAULT_CONNECTION_ID=my-license
```

`id`は英小文字・数字・ハイフン、最大80文字。URLはHTTPSで、URLへのユーザー名・パスワード埋め込みは受け付けない。接続先IDは重複させない。秘密は`NUXT_PUBLIC_`へ置かない。`.env`と証明書をコミットしない。

## AndroidからのHTTPS

EMEには安全なコンテキストが必要。PC自身のlocalhostと異なり、AndroidからLAN上のPCのHTTP URLへ接続する場合にはHTTPSを用意する。[Shaka DRM設定](https://shaka-project.github.io/shaka-player/docs/api/tutorial-drm-config.html)

[mkcert公式手順](https://github.com/FiloSottile/mkcert)で開発用CAを作り、PCのホスト名とLANのIPを証明書のSANに含める。

```sh
mkcert -install
mkcert -cert-file /tmp/veilframe-cert.pem -key-file /tmp/veilframe-key.pem localhost 127.0.0.1 192.168.1.10
pnpm exec nuxt dev --host 0.0.0.0 --https --https.cert /tmp/veilframe-cert.pem --https.key /tmp/veilframe-key.pem
```

IPは開発PCの実際のIPに置き換える。Windowsでは作業用の証明書ディレクトリにパスを変更する。Androidは同じLANへ接続し、`mkcert -CAROOT`内の`rootCA.pem`の公開証明書だけを転送して、OSの証明書インストール設定からCAとして信頼させる。`rootCA-key.pem`やサーバー秘密鍵を端末へ転送しない。

Androidから`https://192.168.1.10:3000`を開く。証明書警告が出る場合はCA・SAN・IPを確認し、警告を無視した状態を検証条件としない。Windowsのファイアウォールでは必要なLAN接続だけを許可する。検証後は端末の開発用CAを削除できる。

## 実機の手順

1. OS・Chrome・端末・GPU設定・接続画面を確認する。
2. 通常DRMを再生し、初回再生の結果を確認する。
3. 標準機能で撮影し、映像部分の目視結果とキャプチャ方法を入力する。
4. 画像を添付し記録を保存する。
5. HW_SECURE_ALLへ切り替え、同じ手順で比較する。非対応なら失敗をそのまま記録する。
6. WindowsとAndroidの記録をZIPで一方へ移し、条件と画像を比較する。

ハードウェア保護要求と黒画面化は別の観測。[EME仕様](https://www.w3.org/TR/encrypted-media/)と[Shakaのrobustness設定](https://shaka-project.github.io/shaka-player/docs/api/tutorial-drm-config.html)を参照する。実機検証の結果をCI画像から推測しない。

## Vercel

GitHubリポジトリが決まった後、VercelでNuxtプロジェクトとして接続する。`vercel.json`のインストール・ビルドコマンドを使う。独自接続の秘密や動画URLの初期値をVercelへ登録する必要はない。`VERCEL=1`の環境では、独自接続有効フラグがあっても独自接続と初期値を返さない。

VercelはNode.jsのメジャー版だけを固定でき、マイナー・パッチは更新される。ローカルとCIは24.16.0、Vercelでは24.16.0以上25未満を許可する。ビルドコマンドが実際のバージョンを出力する。[Vercel公式仕様](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)

VercelのProductionとPreviewをそれぞれ確認し、`/api/connections`に公開テスト接続だけが含まれること、独自素材入力が表示されないこと、通常モードの実機再生を確認する。GitHub連携・デプロイ・実機検証は、コードのローカル検証とは別の実施記録を残す。
