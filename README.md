# Factory Card Game v0.7 — 操作修正版

## 修正内容
- 建築・ベルト配置後に再描画が止まる原因だった、存在しない `#log` の参照を修正。
- ✓で即建築、×はキャンセルのみ。成功時に建築モード終了。
- ベルトの始点をタップ後、終点候補にマウスを合わせると半透明の橙色経路をプレビュー。終点をタップして確定。
- 施設タップ時の浮遊i/ゴミ箱を廃止。施設詳細ポップアップ内でのみ操作。
- 建築半透明プレビューと方向表示を強調。

## 操作
`index.html` は ES Module を使うため、GitHub Pagesやローカルサーバー経由で起動してください。

## 検証
Pythonの単純サーバーとChromiumで基本操作の確認を実施。オンライン・戦闘は未実装です。


v0.8: simulation pulse is independent of board rendering; facility input/output are displayed on perimeter (blue input, orange output). Errors are visible in red banner.
