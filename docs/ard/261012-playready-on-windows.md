# Windows EdgeのPlayReady保護検証

## 背景と合意

Windows 11のBraveで、通常Widevineは再生・撮影できるがHW_SECURE_ALLは非対応になるとの利用者報告があった。現行ChromiumのWindows Widevine実装にはハードウェア保護要求を拒否する処理がある。[Chromium実装](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/cdm/renderer/widevine_key_system_info.cc)

利用者はWindowsの検証対象にEdge＋PlayReadyを追加し、映像SL3000・音声既定条件、非対応時停止、DRM手動選択、DRM方式と保護要件の記録、旧データ互換性とZIP version 3を採用した。

## 判断

Shakaアダプターと再生ポートを拡張し、PlayReady通常は`com.microsoft.playready.recommendation`、保護は`.recommendation.3000`に固定する。音声robustnessは既定条件とする。優先方式の指定だけに依存せず、ライセンス要求前とロード後に実際のキーシステムとの一致を検査する。[Microsoft仕様](https://learn.microsoft.com/en-us/playready/overview/key-system-strings)

ライセンスはNuxt経由を維持し、XML本文とSOAPActionに対応する。ライセンス要求フィルターで接続先URLを固定する。接続設定のdrm省略時は従来のwidevineとし、公開接続にはMicrosoftのTears of Steelテスト素材を追加する。

新記録にはdrmを追加し、保護要件はHW_SECURE_ALLとSL3000を区別する。旧記録は当時Widevine専用だったためwidevineとして変換する。ZIP version 1・2を読み込み、version 3を出力する。DBのストア構造は変えず、読み取り境界で変換する。

## 代替と影響

WindowsでWidevineの要件を緩和する案は、ハードウェア保護の検証にならないため採用しない。DRMの自動切り替えも、比較条件が変わるため採用しない。

EdgeでもSL3000の対応ハードウェアが必要で、再生やOS撮影の黒画面化を保証しない。公開テスト素材の最低ライセンスレベルだけでハードウェア保護を主張せず、クライアントのキーシステム要求と実機観測を区別する。新ZIPの交換先も更新が必要になる。通常CIの再生はテスト用実装を維持する。
