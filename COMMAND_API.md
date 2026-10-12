# 共通命令インターフェース（移行中）

`src/commands.js` の `executeCommand({factory, battle}, {type, payload})` を使います。成功時 `{ok:true}`、失敗時 `{ok:false,error}` が基本です。

命令：`BUILD_FACILITY`（kind,x,y,rotation）、`REMOVE_AT`（x,y）、`PLACE_BELT`（x1,y1,x2,y2）、`SELECT_RECIPE`（buildingId,recipeId）、`SET_WAREHOUSE`（buildingId,mode,filter）、`SET_SHIPPING_GROUPS`（groups）、`DEPLOY_UNIT`（slot,column,row）、`SELF_DESTRUCT`（column,row）、`PLAY_CARD`（slot,target）。

これは今後の命令境界を決めるための初期実装です。現状は失敗結果・権限・リプレイ・マルチプレイヤー所有者の判定が完全ではなく、**オンラインサーバーの命令検証にそのまま使える段階ではありません**。

将来は命令に playerId、tick、sequence を付け、ターン内の決定順、二重送信防止、承認結果を統一します。UIは成功結果が返るまでゲームルールを独自に進めない構造にします。

## v2.4: 戦闘画面への接続

`mountBattle(battle, element, onChange, (type,payload) => executeCommand(game,{type,payload}))` の第4引数に命令実行関数を渡してください。UIのドラッグ/対象選択/自壊確認はこの関数から `DEPLOY_UNIT`、`PLAY_CARD`、`SELF_DESTRUCT` を呼びます。第4引数省略時は単体UI検証向けのローカル互換アダプターになります。

失敗時、`PLAY_CARD` は `needsTarget` / `needsDestination` / `targetType` / `message` を保持しつつ、`error` も返します。カード使用が不発の場合に手札が消費されないことをテストで検証しています。
