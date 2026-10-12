# バランス調整ガイド

現状、数値定義は**まだ完全には一元化されていません**。下記以外のファイルを触る必要がある場合があります。新規追加時は重複定義を増やさないでください。

| 調整対象 | 現在の編集先 |
|---|---|
| 施設建築費・占有マス | `src/facility-catalog.js` |
| 中間素材のレシピ・生産秒数 | `src/production-catalog.js` |
| ユニット・補助カード製造レシピ | `src/card-recipes.js` （元のJSONも参照） |
| ユニットHP・攻撃・基本間隔 | `data/unit-stats.json` |
| 盤面サイズ・初期建築資材・自然増加 | `src/rules-config.js` |
| 準備時間・本体HP・撤去待ち時間 | `src/rules-config.js` |
| 強化倍率、補助効果値、その他施設時間 | `src/engine.js`, `src/battle.js` 等に残存（移行予定） |

調整前に v2.2 の基準値を保管し、変更理由を CHANGELOG に書く。変更後に `npm run check && npm test` を実行。固定ダメージ等の仕様自体は、数値変更とは区別して合意を得てから変更。

`data/production-recipes.json`, `data/cards.json`, `data/card-details.json` は用途が異なる既存資料で、現在は自動同期されません。将来、一つの正本に統合し、そこから表示・実行用データを生成する形を検討します。

## Phase 5 工場・物流の数値
`src/factory-economy-config.js` で採掘周期、ベルト速度、倉庫出荷間隔・容量、加工速度、強化モジュールの作業量、建築割引を変更できます。元の値と動作を保証する固定期待値テストがあるため、**意図したバランス変更時のみ**差分を検証してテスト期待値を更新してください。設定の単位（秒、1秒あたり、必要進捗量）を混同しないこと。

## Phase 6: ユニット能力の調整箇所
`src/balance-config.js` の `UNIT_BALANCE` に、支援効果、対タグ倍率、強化倍率、突撃班の加速などがあります。基本HP/攻撃/リロードは `data/unit-stats.json`。数値変更時は `npm test` を実行し、意図的な結果の変更ならゴールデンテストの更新理由を `CHANGELOG.md` に記録してください。
