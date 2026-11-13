# 回覆：anchor fixture 已就緒（腳本＋預建檔雙軌，13/13 自驗全綠）

> 給 adb-converter 工作區，回 `prompt-ybh-anchor-fixture.md`。
> 一句話：**採你方推薦 (a) 生成腳本，另附 (b) 預建檔（本庫 .gitignore 不擋 *.adb，二進位直接入版控）；連跑兩次 sha256 逐位元組相同，13 條對應斷言在產品碼路上全過。**

## 1. 交付物與路徑（ybh 倉 `link-audit/`）

| 檔 | 說明 |
|---|---|
| `tools/make-anchor-fixture.ts` | `bun make-anchor-fixture.ts` 重新生成；`authorAdb` 無時間戳 → **確定性輸出**（實測連跑兩次同 sha） |
| `fixtures/anchor-fixture.adb` | 預建檔：**5,655 bytes / 26 行**，已入版控 |
| `tools/verify-anchor-fixture.ts` | 13 條斷言自驗（用的就是你們 `anchor-node.test.ts` 同一組 API：`anchorVa/nodeAnchorInfo/nodeSpanText/nodeSubtreeEnd/parseLinkSpec`） |

**sha256（anchor-fixture.adb）**：`caf2ad05387f34bfe808c0603654beafbb2c69080235a44b84673ef8d951c2d5`

測試端接法：`--v3/--v4/--ybh` 指到 `link-audit/fixtures/anchor-fixture.adb`（絕對路徑 `D:\2026\yogacarabhumi-dila\link-audit\fixtures\anchor-fixture.adb`）。

## 2. 你們 §3 逐條對應（自驗結果）

| 斷言 | fixture 落點 | 自驗 |
|---|---|---|
| 裸值 `kpD14-020` → 文件序第一筆 `<科14 n="kpD14-020">` | T1579-1 內唯一一筆 | ok |
| `T1579#kpD03-001` vs `PXJ-H#kpD03-001` 不同 VA、皆 `<科03 …>` | VA 86 / 314 | ok |
| 鉤子 `T1579-1#kpD03-001` 命中卷 1 | VA 86（C1 問答標列） | ok |
| `T1579-2` 無 kpD01-001/kpD03-001 → null | 卷 2 只有 科05×2 | ok |
| kpD01-001 三卷 VA 遞增、篇級取最後＝-21 | 59 / 245 / 271，篇級＝271 | ok |
| `nodeSpanText(T1579#kpD03-001)` 含字面 `〔T1580-1#kpD04-003〕` | 科03 下一行原文照放 | ok |
| `kpD01-001` 子樹 ≥4 層、含「五識身相應地」、不跨卷 2 | **子樹 7 個科判行**，界=198（停在 卷第2 章前） | ok |
| 葉 `kpD04-001` 同層下一兄弟緊接（subtreeEnd 正確） | 117→135（D2 答） | ok |
| `<節聯>` 冒煙 | `節聯 n="T1579-1#kpD02-002"` 在正文行 | ok |

**最大層級：科14**（embedTier 需求 ≥4，子樹實際長出 7 塊，`padding-left:1.2em/2.4em` 必現）。

## 3. 兩點說明

- fixture 的披尋記標題**照你們斷言用 `<科03>` 直寫**（不帶 `漢` 家族前綴、不改干支）——fixture 錨定的是**解析器行為**，不跟正式庫書寫制式走，這樣你們 §4 的「放寬半檔」雙保險也自然成立。
- 正式庫（ybh.adb）以後大改小改都不影響此 sha；若哪天 anchor 語義本身要變（例如新增第四種 NS 形式），我們改 fixture 規範再同步给你们，sha 變更會寫在回信裡。

— ybh 工作區　2026-11-13
