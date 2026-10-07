# Source AI — Research Console

GitHubやWebページのソース、貼り付けたHTML／コードを読み、Gemini 3.1 Flash-Liteが根拠を添えて日本語で提案するWebアプリです。Web検索のグラウンディング、トークン単位のストリーミング表示、Markdown回答、ブラウザ内の会話保存を備えます。

## Vercelへデプロイ

このフォルダーをGitHubリポジトリへpushし、Vercelで **Add New → Project** からそのリポジトリをImportします。Framework Presetは **Other**（静的ファイル＋Node.js Functions）で構いません。Build Commandは空欄、Output Directoryは空欄のままDeployします。画面・CSS・ブラウザー側JavaScriptはすべて単一の `index.html` に内蔵してあり、UI用の別ファイルやJS／CSS CDNは不要です。Gemini接続用のサーバー関数 `api/`、共通処理 `lib/`、`vercel.json` はリポジトリルートの構成を保ってください。

## WindowsからGitHubへ登録

ZIPを展開し、先にGitHubで空のリポジトリを作成します。展開したフォルダー内の `setup-github.bat` を実行し、GitHubリポジトリURLを入力してください。Git for Windowsが必要です。Gitのユーザー名／メールアドレスが未設定の場合は、このプロジェクト用の設定を入力します。push後はVercelでそのリポジトリをImportします。

VercelのProject → **Settings → Environment Variables** で以下の2つを **Secret** として登録し、対象環境（Production、必要ならPreview／Development）を選んで保存します。その後、Redeployしてください。

| Name | Value |
| --- | --- |
| `GeminiAPI1` | Google AI Studioで発行したGemini APIキー1 |
| `GeminiAPI2` | Google AI Studioで発行したGemini APIキー2 |

キーはブラウザへ配布されず、`api/chat.js` のサーバー側からのみ読み込みます。サーバー稼働インスタンス内で、リクエストごとに設定済みキーを交互に選びます。Vercel Serverless Functionsは複数インスタンスを使い、コールドスタートでメモリが初期化されるため、これは**アプリ全体で厳密に一つずつ交互に割り当てるグローバルカウンターではありません**。キーはGoogleのGemini Developer APIで利用可能なものを設定してください。

Gemini APIの同じ利用プロジェクト内のAPIキーを2本作っても、APIの利用枠が2倍になるとは限りません。利用上限・課金設定はGoogle AI Studio／Google Cloud側のプロジェクトに従います。

## ローカルPreview

Node.js 20以降で `npm run dev` を実行し、`http://localhost:3000` を開きます。ローカルでもAPIを使う場合は、環境変数をシェルで設定するか、プロジェクトルートの `.env.local` を用意して `node --env-file=.env.local server.js` で起動します。`.env.local` はGitへ追加しないでください。

## 仕様と注意点

- コードの貼り付け／ファイル添付はUTF-8換算で最大1 MiB。URL取得も最大1 MiBです。GitHubのリポジトリURLでは既定ブランチからHTML／コードを優先して最大24ファイル、合計1 MiBまで読みます。GitHubのファイルURLやRaw URL、公開Web URLも利用できます。
- URL取得は公開HTTP(S)サイトのみ許可し、ローカル／内部ネットワークへのアクセス、非標準ポート、過大な本文を拒否します。認証が必要なページや、サイトのアクセス制限を回避する取得には対応しません。
- Web検索の参照リンクはGeminiのGoogle Search groundingから返された場合に表示します。Web検索をオフにした場合、回答は読み込んだソースとモデル知識に基づきます。
- 会話、Markdown回答、読み込んだソースはそのブラウザのlocalStorageへ保存します。別の端末やブラウザ間では同期されず、サイトデータの消去で失われます。
- Markdownはブラウザ側でサニタイズしてから描画します。ファイルはテキストとして読み込み、コードを実行しません。
- Vercel Functions側にはプロバイダー利用量に伴うコストが発生し得ます。Google APIキーには必要に応じて利用制限を設定してください。
