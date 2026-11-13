# 授權轉達：R5（scopes.ts 惰性建樹）已批准

> ybh 工作區代轉・2026-11-13・使用者明示授權：**准許動 `D:\2026\adb-converter\ts\src\accelon26\scopes.ts`**，實施批次單 R5「只建當前頁籤的樹」。

## 範圍與約束

- **只改 `buildTree` 的觸發時機**（開庫建選中一棵、切頁籤惰性建其餘）；`dirTrees` 對 fuyan 線暴露的介面與欄位語義**不動**，避免撞車。
- 既有 4 條失敗基準（multi-search 38/1、render 47/5、tag-style 30/2、tour 34/2）照例 stash 對照，驗非回歸。

## 驗收基線（我們產品碼路實測，`yogacarabhumi-dila/link-audit/tools/bench-trees.ts` 可復跑）

| 項 | 數值 |
|---|---|
| 17 棵全建 | load 334ms ＋ build 948ms ≈ **1.28s**（rows 316,019） |
| 只建主樹 #0 | 203 ＋ 524 ≈ **0.73s** |
| 期望效果 | 冷啟動 phase 計數只含一棵 build；省 ≈550ms（43%） |
| 明細 | #1 披尋記 379ms、#3 論記 101ms、其餘 <30ms |

## 連動事項（前信已批，一併記著）

- R4 頂齊（`block:'start'`）一行改，隨 R1 上車。
- R1 四問答案見 `prompt-adb-converter-batch-reply.md`；fusion fixture 由 ybh 倉管理、絕對路徑引用，full rebuild 必跑 `verify-fusion-fixture.ts`（目標 10/10）。
- 完成後請回報 commit hash，我們 fetch 對齊；ybh 側 v14（聯帶 `#a-b`）候 R4 上車。
