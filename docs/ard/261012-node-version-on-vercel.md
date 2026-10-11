# Node.jsのローカル固定とVercel

状態：採用。質問74で利用者が承認。

## 決定

ローカルとCIはNode.js 24.16.0に固定し、Vercelでは24.16.0以上25未満を許可する。package.jsonのenginesで範囲を指定し、ビルド時に実バージョンを出力する。pnpmは11.9.0に固定する。

## 理由と代替案

[Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions)はメジャー版を選択する方式で、マイナー・パッチ版は提供元が更新する。すべての環境で24.16.0のみを受け付ける設定はVercelの更新でインストールを失敗させるため、互換範囲を許可する。

## 影響

ローカルとCIの再現性を保ち、Vercelのビルドログには実際のバージョンが残る。Node.js 25以降への変更は別の互換性確認を行う。
