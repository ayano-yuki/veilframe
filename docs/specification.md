# 仕様と操作

## 検証対象

対象はWindows・AndroidのChrome・BraveのWidevine、およびWindows EdgeのPlayReady。DRM方式は手動選択し、それぞれ通常／ハードウェア保護を比較する。Widevine通常モードはrobustnessの既定値、保護モードは映像・音声の両方に`HW_SECURE_ALL`を指定する。PlayReady通常モードは`com.microsoft.playready.recommendation`（SL2000）、保護モードは`com.microsoft.playready.recommendation.3000`（SL3000）を指定する。PlayReadyの音声robustnessは既定条件とし、音声のハードウェア保護は要求しない。複数候補を与えず、非対応時に通常モードや別DRMへフォールバックしない。

WindowsのChrome・Braveでは、現行ChromiumのWidevine実装がハードウェア保護要求を拒否する。アプリでOSやブラウザ名を推測して再生を禁止せず、EMEの実結果で非対応を判定する。[Chromium実装](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/cdm/renderer/widevine_key_system_info.cc)

再生条件の変更は既存プレイヤーを破棄し、結果を待機状態に戻す。再生ボタンで条件を適用する。SSR直後はクライアントが準備できるまで再生・保存を無効にする。

## 画面

| URL            | 内容                                                       |
| -------------- | ---------------------------------------------------------- |
| `/`            | 素材・保護条件、動画、再生結果、実機の目視結果と画像の保存 |
| `/records`     | 記録一覧・詳細、ZIP交換、確認後の削除                      |
| `/connections` | 許可済み接続先の識別名と利用可能な接続範囲                 |

公開環境では公開素材だけを選択できる。独自動画URL・独自接続先の選択は有効化したローカルだけに表示する。接続設定画面にライセンスURL・認証ヘッダーを表示しない。

## 公開素材

SintelのShaka Player公式デモ用Widevine DASH素材を使用する。

- 素材：[Shaka公式デモの素材定義](https://github.com/shaka-project/shaka-player/blob/main/demo/common/assets.js)
- マニフェスト：`https://storage.googleapis.com/shaka-demo-assets/sintel-widevine/dash.mpd`
- ライセンス：`https://proxy.uat.widevine.com/proxy`（Nuxt経由）
- サービス証明書：`https://cwip-shaka-proxy.appspot.com/service-cert`（Shakaが取得）
- 映画：[Sintel / Blender Foundation](https://durian.blender.org/about/)、CC BY 3.0。クレジットを含む映画を使用し、UIにも提供元とライセンスへのリンクを掲載する。

提供元のデモ素材・テスト用エンドポイントを利用し、動画をリポジトリへ複製しない。テストサービスの継続稼働はアプリのCIが保証する対象ではない。提供元を変更する際は利用条件と設定を再確認する。

## 記録

記録はUUID、UTCの作成日時、素材名、接続先識別名、DRM方式、再生モード、要求robustness、対応確認結果、初回再生結果、OS・ブラウザ種類・バージョン・端末・User-Agent、キャプチャ方法、目視結果、メモ、画像の記述子を持つ。画面の日時はAsia/Tokyoで表示する。

ブラウザ情報は取得したUser-Agent文字列を使う。OS・ブラウザ種類（Chrome / Brave / Edge / 未確認）・ブラウザバージョン・端末・撮影方法は利用者が確認して入力する。空欄や未確認を許可し、推測しない。再生の成功を「映像が黒くなる」という観測へ自動変換しない。

失敗・非対応・再生前の記録も保存できる。対応確認の`supported`はその要求で初回再生に成功したこと、`unsupported`は一般的な再生APIまたは要求するDRM構成が非対応と判明したことを意味する。その他の失敗は`unknown`とする。再生結果は初回再生操作の結果であり、その後の手動一時停止や動画終了とは別である。

動画URL・認証ヘッダー・ライセンス本文を自動保存しない。自由記述のメモ・素材名・画像には利用者が入力・撮影した内容が含まれる。IndexedDBは同じオリジンとブラウザで保持され、別オリジンへはZIPで移す。

## 容量と交換形式

| 対象             | 上限                                 |
| ---------------- | ------------------------------------ |
| 画像             | PNG・JPEG・WebP、1枚10 MiB、1記録5枚 |
| ZIP入力・出力    | 100 MiB                              |
| ZIP展開後        | 200 MiB                              |
| 記録数           | 1,000                                |
| ZIPファイル数    | `records.json`と画像を合わせて5,001  |
| メモ             | 5,000文字                            |
| 素材名・環境入力 | 各200文字（ブラウザ情報は500文字）   |

ZIPは`records.json`（`version: 3`）と`images/<record UUID>/<image UUID>`で構成する。JSONに画像のMIME・サイズを保存し、画像の個別ファイル名に動画URLや元ファイル名を使わない。未知のフィールド、余分なファイル、不足画像、重複ID、形式・サイズ不整合を拒否する。画像形式の検証はMIMEと記述子の整合性に基づく。

全件を検証後、一つのIndexedDBトランザクションで取り込む。不正な入力は全体を中止する。保存済みIDは上書きせずスキップする。既存記録と競合する場合は保存済みを優先する。

旧IndexedDBの記録とversion 1・2のZIPは読み込み時に新形式へ変換する。旧記録は当時Widevine専用だったため`drm: widevine`とする。ブラウザ種類は推測しない。旧`environment.chrome`は`browserVersion`へ移し、`browserName`は`unknown`にする。User-Agentから種類を推測しない。ID・日時・メモ・画像を保持し、既存DBは読み込みだけで書き換えない。新規保存とエクスポートは新形式を用いる。新ZIPは旧アプリへのインポートに対応しない。

## PlayReady公開素材と転送

Tears of SteelのMicrosoft公開テスト素材を使う。提供元のCC BY 3.0の表示・クレジットを保持する。[素材の利用条件](https://mango.blender.org/about/)、[Shaka公式素材一覧](https://github.com/shaka-project/shaka-player/blob/main/demo/common/assets.js)

- マニフェスト：`https://test.playready.microsoft.com/media/profficialsite/tearsofsteel_4k.ism/manifest.mpd`
- 接続先ID：`microsoft-playready`
- ライセンス：`https://test.playready.microsoft.com/service/rightsmanager.asmx?cfg=(persist:false,sl:150)`
- H.264映像・AAC音声のDASH / CENC。公開マニフェストを2026-10-12に取得して形式を確認した。実機再生は別の検証。

公開テストライセンスの最小レベルは150で、クライアントは通常モードにSL2000、保護モードにSL3000の専用キーシステムを要求する。サーバーの最小レベル指定だけでハードウェア保護を主張しない。

ライセンス要求はShakaがPlayReady形式を展開し、NuxtサーバーがXML本文を変更せず転送する。Content-Typeは`text/xml; charset=utf-8`、SOAPActionはサーバーでAcquireLicenseに固定する。ブラウザから任意の転送ヘッダーを受け付けない。Widevineは引き続きバイナリ形式。容量・タイムアウト・リダイレクト拒否は共通。[MicrosoftのSOAP仕様](https://test.playready.microsoft.com/service/rightsmanager.asmx?op=AcquireLicense)

接続先設定は`drm: widevine | playready`を持ち、省略時は既存設定との互換性のためwidevineとする。画面は選んだDRMに一致する接続先だけを表示する。ライセンス要求フィルターは実際のDRM方式を確認し、選択したNuxtのライセンスURLへ固定する。初回ロード後にも実際のキーシステムを確認し、不一致・DRMなしの素材を成功扱いにしない。
