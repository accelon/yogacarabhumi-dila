# 需求批次單：給 accelon26（P4 之後一次做完的清單）

> ybh 工作區・2026-11-13・彙整散在規格書與往來回函中的所有待辦，逐條附**驗收方式**。
> 優先序由 P0（阻塞體驗）到 P3（加分）。所有斷言走 `verify-fusion-fixture.ts` / `anchor-node.test.ts`，fixture 已凍結、sha 為憑。

## R1（P0）融視圖實裝——規格與閘已備
- 依 `draft-fusion-view-spec.md` §2 六件事：視圖開關、`<融>` 佔位以目標子樹 span 覆寫（`nodeSubtreeEnd`、max 200）、缺目標保留佔位＋warn、切科文樹＝重排同一份論本、視圖內交互＝節聯行為、延遲取段。
- **先拍板 §5 四問**（開關位置／`.fusionBlock` 樣式／taisho 舊 `<融>` 是否併入／跨庫頁欄取段）。
- 驗收：`verify-fusion-fixture.ts` 由 5 passed＋5 GATE 變 **10/10**，GATE 全轉 ok。
- 材料：`link-audit/fixtures/fusion-fixture.adb`（sha `4748139d…`，雙跑確定）。

## R2（P0）測試接 fixture——別再綁正式庫
- `anchor-node.test.ts` 的 `--v3/--v4/--ybh` 改指 `anchor-fixture.adb`（sha `caf2ad05…`）；fusion 段指 `fusion-fixture.adb`。
- 你們來文自報的 4 條失配（48/4）即此項的現階症狀；ybh 合併與 v9–v13 演進會繼續弄紅綁實檔的測試。
- 驗收：`anchor-node.test.ts` 全綠且**不再依賴 D:\accelon3 的 ybh 檔存在與版本**。

## R3（P1）j 口徑鎖死——taisho 側加一條防退化斷言
- 我們 v13 的 35,025 條 CBETA 聯／24,428 條行內嵌全部按「**頁＝<頁 id> 標記到下一標記、isHan 計序**」（＝`pageHanTextOf`/renderEmbed 頁分支現行定義）算 j。
- 請求在 `anchor-node.test.ts` 加一條 pin：`pageHanTextOf(taisho,'30p793a')` 中「復次嗢拕」索引 **＝ 38**（我們實測值）。日後誰改頁切段或計序規則，這條先紅。
- 驗收：新斷言綠；我們这边 `verify-j.ts` 抽樣 25/25 與其互證。

## R4（P1）跨庫聯精確定位——`i="db?頁欄#a-b"` 右欄捲到字位
- 現況：`handleXref` 的 `openCharPosition` 精準定位只在 **db===mainName** 生效；跨庫走 `openForeignTab`（帶 quote/j 但右欄是否捲到字位、高亮是否精確，未確認）。
- 請求：跨庫 `i="taisho?30p279a#40-44"` 開啟右欄時**捲到該漢字區間＋高亮**，與同庫行為對齊。若已如此，回信確認即可；若未，補上。
- ybh 掛鉤：確認後我們 v14 把 35,025 條 CBETA 聯從 `i="taisho?頁欄"` 升級為 `i="taisho?頁欄#a-b"`——點「CBETA」直接落在該科原文處，不再只落到頁首。
- 驗收：taisho 在右欄開啟時，上述格式點擊後視口首行含目標引文首四字。

## R5（P2）多樹大庫的目錄惰性建造
- ybh 現 17 棵樹、主樹 17 萬節點；`scopes.ts` 若開庫即建全部 `wanted` 樹，冷啟動成本可觀。
- 請求：只建**當前選中頁籤**的樹，其餘切到才建（已有 `dirPaneShown` 惰性渲染的鋪路，延伸到 build 層）。
- 驗收：開 ybh.adb 計時對比（phase 計數器已有 `trees/load/build/instances`），冷啟動只計一棵樹的 build 時間。

## R6（P3）嵌截斷「繼續展開」
- 雙方回函已定口徑：大科子樹 4% 超 200 行 → 截斷，讀者按「繼續展開」取下一段。reader 端未實裝該按鈕。
- 驗收：對 `T1579-1#kpD01-001`（子樹 25k 字）開 `sub="1"`，出現截斷提示與展開按鈕，點擊追加下一 200 行。

## R7（P3）反鏈量大戶分頁
- ybh→taisho 聯將達 3.5 萬條；單頁反鏈一排與清單抽屜在高频頁（如 30p279a）可能過長。
- 請求：反鏈列表面板化／分頁（現有 drawer 100+ 條的機制延伸即可），熱圖不受影響。
- 驗收：30p279a 反鏈顯示抽樣不卡、可翻頁。

---
**依賴圖**：R2→（R1 的 GATE 轉斷言需要 R2 的接法）；R3 獨立；R4 擋 ybh v14 的聯升級（不擋 R1）；R5/R6/R7 獨立。
**ybh 側掛鉤**：R4 確認後我出 v14（聯帶 #a-b）；R1 完成後我把 P1 span 表改寫 `<融>` 形態出 v15（科文樹即融視圖資料源）。
