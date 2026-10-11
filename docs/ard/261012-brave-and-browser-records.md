# Brave対応とブラウザ記録の互換性

## 合意

質問75〜77で、Windows・AndroidのBrave、ブラウザ種類とバージョンの手動記録、旧記録・旧ZIPの互換性、Chromium CIと実機Braveの手動検証を採用した。

## 判断

Shaka・Widevineと既存の通常／HW_SECURE_ALL要求を共有する。ブラウザ名から再生能力を推測せず、EMEの実際の結果を用いる。Widevineの有効化手順を画面から参照できるようにする。保護要件の自動緩和は行わない。

環境情報は`browserName`（unknown / chrome / brave）と`browserVersion`へ変更し、User-Agentは既存の`browser`へ保持する。旧`chrome`の値はバージョンへ移し、種類はunknownにする。

IndexedDBのストア構造は変わらないためDBバージョン1を維持し、読み取り境界で厳密検証・変換する。読み込みで既存データを書き換えない。ZIPは新形式をversion 2として出力し、入力はversion 1と2を識別して、それぞれのスキーマを厳密検証する。

## 代替と影響

旧`chrome`をそのまま使う案は、種類を区別できず、意味と識別子が一致しなくなるため採用しなかった。UAによる種類推定は合意済みの「推測しない」に反するため使わない。

旧記録のID・日時・画像を保持する。重複IDは既存優先のまま。新ZIPは旧版アプリでは読めないため、交換先も更新する。Chromium CIはBrave本体のWidevine・保護経路を検証した証拠にはしない。
