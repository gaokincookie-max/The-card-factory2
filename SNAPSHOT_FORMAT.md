# 状態の書き出しと復元（v2.3 実験用）

```js
import {exportSnapshot,importSnapshot} from './src/match-state.js';
const snapshot=exportSnapshot({factory,battle});
const serialized=JSON.stringify(snapshot);
const restored=importSnapshot(JSON.parse(serialized));
```

- 保存形式は `{version:1,factory:{...},battle:{...}}`。
- `battle.factory` は循環参照を避けて保存しない。復元時に同じ `factory` を参照する。
- ランダム抽選の状態（`factory.seed`）も保存する。
- 内容は変化から独立したディープコピーであり、元状態の書き換えはしない。
- 読み込み検証は最低限。**任意の外部入力を安全と保証しない**。ローカル保存UIや公開オンライン通信には、そのまま使用しないこと。
- 将来のフォーマット変更では `version` を上げ、明示的な移行関数を実装する。
