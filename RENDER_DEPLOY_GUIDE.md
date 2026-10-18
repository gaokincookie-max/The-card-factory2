# v3.8 Render Free 配布準備

## 役割
- GitHub Pages: ゲーム画面の静的ホスティング。
- Render Free: `npm run server` でColyseus対戦サーバーを実行。
- Firebase: 今回は使用しない。

## ユーザーの手順
1. ZIPを展開し、`package.json` と `render.yaml` が同じ階層にあることを確認。
2. GitHubに**ゲームファイル一式**を新規リポジトリとしてアップロードまたはpush。`node_modules/`、秘密情報はアップロードしない。既存のGitHub Pages用リポジトリを更新してもよいが、公開サイトが変わるので注意。
3. [Render Dashboard](https://dashboard.render.com/) にログイン → New → **Blueprint** を選び、GitHubリポジトリを接続。`render.yaml` を読み込み、Web Serviceが **Free** と表示されることを確認してデプロイ。Blueprintが使えない場合は New → Web Service、Runtime Node、Build Command `npm install`、Start Command `npm run server`、Instance Type **Free** を選択。
4. `https://<サービス名>.onrender.com/` を開き、`status: ok` の応答を確認。初回起動は時間がかかることがある。
5. 既存のGitHub Pages（https://...）のメニューから「フレンド対戦」を開き、サーバーURL欄に `wss://<サービス名>.onrender.com` を入力。`https://` ではなく `wss://`。最初の接続で入力内容は端末のブラウザに保存される。
6. 2人が同じ**ゲームの公開ページ**を開き、片方でルーム作成、もう一方でルームID参加。パソコン上の `npm run server` は不要。

## 制約・重要事項
- 公開URLを知る人がアクセス可能。**認証・アクセス制限なし**。プライベート対戦の安全性はまだ本番水準ではない。ルームIDも完全なアクセス制御ではない。
- Render Freeは15分間HTTP/WSメッセージ受信がないと休止し、起動待ちがある。再デプロイ/サーバー再起動後は進行中の試合が消える。切断だけの90秒再接続とは別。
- 無料サービスも利用量条件があり、支払い方法登録時は超過課金の可能性がある。プランFree表示・使用量を確認。
- 現在はSDKを `https://esm.sh/colyseus.js@0.16` から取得する。通信テスト用であり、本公開前にバージョン固定と依存の監査が必要。
- サーバーは全部の試合をメモリ上で処理。無料CPUで5試合同時に動くかは負荷試験未実施。
- Renderでの**実デプロイは未実施**。設定・起動可能性はローカル構文/ゲームテストのみ。
