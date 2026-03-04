# PR Comment Jumper

GitHub PRページのコメント間をすばやくジャンプできるChrome拡張機能です。

長いPRレビューで特定のコメントを探す手間を省き、サイドバーパネルからワンクリックで目的のコメントにスクロールできます。

## Features

- **コメント一覧パネル** — PRページ右側にコメント一覧をサイドバー表示
- **ワンクリックジャンプ** — コメントをクリックするとスムーズスクロールで該当箇所へ移動
- **ハイライト表示** — ジャンプ先のコメントを青いグロウエフェクトで強調
- **折りたたみ自動展開** — 折りたたまれたコメントスレッドやoutdatedコメントを自動展開
- **リアルタイム更新** — MutationObserverで新規コメントを自動検知・反映
- **ダークモード対応** — GitHubのテーマに合わせてUIが自動切替
- **GitHub SPA対応** — Turboナビゲーション時も正しく再初期化

## Install

1. このリポジトリをクローン
   ```
   git clone https://github.com/s4na/chrome-pr-comment-jumper.git
   ```
2. Chromeで `chrome://extensions` を開く
3. 「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」からクローンしたフォルダを選択

## Usage

GitHubのPRページ（`https://github.com/*/*/pull/*`）を開くと、ページ右側にコメントパネルのトグルボタンが表示されます。

ボタンをクリックしてパネルを開き、一覧からコメントをクリックすると該当箇所にジャンプします。

## File Structure

```
├── manifest.json        # Chrome拡張マニフェスト (v3)
├── content.js           # メインロジック
├── content.css          # UIスタイル
├── icons/               # 拡張アイコン
├── tests/               # Jestテスト
├── jest.config.js       # Jest設定
└── .github/workflows/   # CI設定
```

## Development

```bash
npm install
npm test
```

### ビルド（配布用）

`dist/` に拡張機能に必要なファイルのみをコピーします。

```bash
npm run build
```

Chrome Web Storeへの公開やパッケージサイズを最小化したい場合は、`dist/` ディレクトリを使用してください。

## License

MIT
