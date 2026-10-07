# 公式仕様の参照先

## Gemini 3.1 Flash-Lite

出典: [Gemini 3.1 Flash-Lite — Gemini API](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite)

公式モデルコードは `gemini-3.1-flash-lite`。同ページでは、入力上限1,048,576 tokens、出力上限65,536 tokens、Search groundingおよびURL context対応が記載されています。アプリはこのモデルコードをGemini REST APIのストリーミング呼び出しに指定します。

## Vercel環境変数

出典: [Environment Variables — Vercel Docs](https://vercel.com/docs/environment-variables)

Vercelでは環境変数をプロジェクト／デプロイ環境ごとに設定できます。APIキーなどの秘匿値にはSecretタイプを選択してください。値の変更は新しいデプロイメントに適用されるため、設定後にRedeployします。

## VercelのNode.jsサーバー自動検出と静的出力

出典: [Node.js Runtime — Vercel Functions](https://vercel.com/docs/functions/runtimes/node-js)

Vercelはプロジェクトルートまたは `src/` の `server.{js,cjs,mjs,ts,cts,mts}` をNode.jsサーバーのentrypointとして検出し、リクエストをそのFunctionへルーティングします。静的HTMLと `/api` Functionsを分けたいこの構成では、ローカルPreview用サーバーを `preview-server.cjs` として配置し、entrypoint名 `server.*` と衝突させません。

出典: [Configuring a Build — Vercel](https://vercel.com/docs/builds/configure-a-build) と [Static Configuration with vercel.json](https://vercel.com/docs/project-configuration/vercel-json)

ビルド不要のOther presetでは、`public/`があればそこ、なければプロジェクトルート `.` が静的出力先になります。`vercel.json`の`outputDirectory`で出力先を明示できます。
