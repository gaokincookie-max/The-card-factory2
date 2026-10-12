## v3.0
- 全画面階層式のメインメニューへ変更。
- ホームでカテゴリ詳細を非表示、選択後にカテゴリ全画面表示、左上で戻る。
- 設定・フレンド・既存CPU対戦への接続を維持。

# Changelog

## v2.2 — 基盤整理 Phase 1
- v2.1のUI・ルールをベースとして保存。
- `facility-catalog.js` に施設マスタを分離（名称・寸法・価格、元の値を維持）。
- `production-catalog.js` に中間素材レシピを分離（元の値を維持）。
- `rules-config.js` に基本定数の一部を移し、工場・戦闘エンジンから参照。
- `commands.js` に互換性を保つ共通操作APIの初期版を追加（現時点ではUI未移行）。
- `tests/commands.test.mjs` を追加、現行仕様に合う回帰テストの実行コマンドを整備。
- 開発ドキュメントを追加。正式メニュー画面、ネットワークは未実装。

## 次のPhase
- 残るハードコード数値、能力効果、倉庫、物流の各モジュール化。
- ゲームUIから状態変更コードを排除し、すべて `commands` を介する。
- 決定論的乱数、ゲームセッションのスナップショット・リプレイを設計。
- 不要な再描画の計測と削減、ブラウザ・スマホ横画面の実測。
- メニュー画面は AppShell を新設する時点で追加。

## v2.3 (基盤整理 Phase 2)
- 主な工場画面操作をコマンドAPI経由に移行。
- 倉庫抽選・衛生兵抽選の乱数をシード管理へ変更。
- バージョン付き状態スナップショットと headless 進行APIを追加。
- 再現テストと引き継ぎドキュメントを追加。ゲーム性能値は変更なし。

## v2.4 基盤整理 Phase 3
- 戦闘画面のユニット配置、補助/素材カードの対象選択、自壊を共通命令APIに移行。
- 戦闘命令失敗時のエラーフィールドを正規化。
- `tests/battle-boundary.test.mjs` でUIの操作が使用する命令経路を追加検証。
- ゲームバランス値・確定済みルールには変更なし。

## v2.5
- 戦闘シミュレーションとブラウザ入力・描画を分離（公開APIは互換）。
- 補助カードの固定効果量・持続時間および回復間隔を設定ファイルに移動。
- 分離と数値互換性のテストを追加。

## v2.6 Phase 5 — Factory economy settings
- `factory-economy-config.js` を追加。採掘、倉庫、ベルト、施設強化の既存数値を移動（数値変更なし）。
- v2.5の同条件シミュレーションから生成した期待値を使う工場回帰テストを追加。
- 開発者向け `PHASE5_NOTES.md` を追加。オンライン対戦・CPU工場などの未実装項目は従来どおり。

## v2.7 — Phase 6
- ユニット固有能力の倍率・秒数を `UNIT_BALANCE` に集約。既定値は不変。
- v2.6との戦闘結果完全一致を確認し、20体×150ステップのゴールデンテストを追加。
- 既存の起動方式とUIは変更なし。

## v2.8 (Phase 7)
- 工場の時間更新処理を `factory-simulation.js` へ分離、公開APIとゲームデータを維持。
- 工場の施設方向オーバーレイを差分更新に変更。
- 独立モジュールの回帰テストと再実行可能なベンチマークを追加。
- 工場計算の測定値はv2.7からほぼ変わらず（改善未確認）。
- ブラウザ自動操作テストは完了できず。残課題は `PHASE7_NOTES.md`。

## v3.1 — 2人対戦のヘッドレス共通土台
- 両チームの工場を独立させ、戦場を共有する `src/duel-match.js` を新設。
- 二人対戦ではCPUの周期自動出撃を停止。ユニット配置、補助カード、施設命令を陣営別に処理。
- 敵の工場・手札を含まないプレイヤー別表示データ、Snapshot保存・復元を追加。
- `tests/duel-match.test.mjs` 追加、既存テストを維持。
- 詳細は `PHASE8_DUEL_FOUNDATION.md`。Colyseus通信・2ブラウザUIは次段階。

## v3.2 - Colyseus communication foundation
- Colyseus room server and private per-player state updates.
- Dedicated browser room creation/join and building-command smoke test page.
- Session lifecycle and authority tests; original game modes preserved.
- Real WebSocket end-to-end verification deferred until dependency installation.

## v3.3 共通UIオンライン接続（工場編・未完成）
- メインメニューから同一工場画面にオンライン接続を追加。
- ローカルとオンラインで工場UIを複製せず、コマンド送信先を切替。
- サーバーのプレイヤー別状態を工場盤へ反映。クライアント側の進行停止。
- 戦闘操作は未対応としてブロック。
