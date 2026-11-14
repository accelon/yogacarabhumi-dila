# 反鏈索引查不到 ybh 的聯——R7 那一格因此驗不成（附 repro 腳本與儀表數字）

> 給 accelon26 母區。接 `prompt-ybh-r7-shipped.md`（R7 一排 cap／抽屜分頁）。
> 一句話：**你們的 cap 與分頁程式碼確實在 exe 裡（`revShowAll`×3、`revMore`×3），但從 ybh.adb 這侧點進去時反鏈恒為 0 筆，抽屜永遠停在「載入中…」，所以我無法驗收 cap=20 與 200／頁。**
> 這看起來是**反鏈索引與 `頁欄#a-b` 座標的鍵不合**，不是 ybh 資料缺件——我方 49,749 條 `<聯 i="taisho?…">` 全數解析通過（跨庫驗證 29,350 種座標 0 FAIL）。

## 一、我怎麼測的（可重現）

真啟動 `D:\accelon3\accelon26.exe`（自用 `ACCELON26_DEBUG_PORT`＋`ACCELON26_WEBVIEW_DIR`，不動你們的實例），用你們自己的 `ts/tools/_cdp.ts`（`Cdp.attach`／`loadAdb`）驅動。腳本在本區 `link-audit/tools/test-exe-r7{d,f,h,i,j}.ts`，最关键是 `test-exe-r7j.ts`（讀你們留在 window 上的儀表）。

步驟：開 `ybh.adb`＋`taisho.adb` → active=ybh → 樹頁籤選「瑜伽師地論科句披尋記科判」→ 點「甲一、本地分」→ 正文 58 顆 `.xrefLink` → 點 `data-xref="taisho?30p279a#34-40"` 那顆。

**先決條件（害我前六輪白跑，寫下來給往後的自動化用）**：啟動時「開放古籍平台」對話框會蓋住主欄，`啟動時顯示本頁面` 預設勾著；不先關掉，所有點擊都打在遮罩後面、DOM 查得到元素但無效。

## 二、量到的東西

| 項目 | 實測值 | 該是多少 |
|---|---|---|
| `window.__revBar` | `{db:'taisho', pageId:'30p279a#34-40', count:0, srcs:[]}`（2 分鐘內 8 次重測皆同） | ybh 指到 279a 這一欄的聯有數千條 |
| `.xrefRevBar` | 從不出現（`revBarHtml` 在 `items.length===0` 時回空字串，行為自洽） | 應出現，且 >40 條時一排只 20 顆 |
| 反鏈抽屜 | 標題列一直在「**載入中…**」，8 次重按都不出列 | 起手 200／頁 |
| `__revPerf` | `{ms:21, n:2403, xrev:false}` | 我方 `聯` 總數 **49,749**（其中指 taisho 者全數） |
| `__xrefPerf` | `{reader:0, index:0, reverse:0, page:35, paint:14, total:48, via:'none'}` | `reverse` 顯然是 0 工作 |
| `__xrefLast` | `{cands:0, quoteLen:12, hit:0, via:'none'}` | 同頁欄應有大量候選 |

`n=2403` 對 49,749 條聯——索引似乎只收了極小一部分；`reverse:0` 與 `cands:0` 則指向查表那一步沒命中任何鍵。

## 三、我方讀碼得到的假設（請你們判定，我不改你們的碼）

`page-text.ts:66`：

```ts
export function shortPageId(id: string): string {
  const m = /^(\d+)[pP]0*(\d+)([a-z]?)$/.exec(id);   // 錨點 $ → 帶 #a-b 的 id 進不了這個 regex
  if (!m) return id;
  ...
}
```

`xref.ts:438` 把 `i` 值切成 `db`／`anchor` 後，`anchor` 是**含 `#a-b` 的整串**（v14 起我方資料全數升級成 `頁欄#a-b`），索引鍵 `db + '?' + shortPageId(anchor)`（:470）因此是 `taisho?30p279a#34-40`；查表端（:1034）用的也是 `pageId`。兩邊若有一邊先剝掉 `#a-b`、另一邊沒剝，就永遠對不上——請查：

1. `revBarHtml(db, pageId)` 的 `pageId` 從何而來（是否含 `#a-b`）；
2. 索引是否該統一用 `anchor.split('#')[0]` 過 `shortPageId`，查表也照同一口徑；
3. `n=2403` 是否代表索引只掃了部分 `聯`（例如只掃 active db、或上限截斷）。

## 四、你們修好後我這邊會立刻做的事

用同一支 `test-exe-r7j.ts` 重跑，並把 R7 四格補完：① 一排 20 顆＋「顯示全部 N 條」；② bar 上 `data-revhost/page/revlistname` 與 `__revBar.count` 相符；③ 抽屜起手 200、`.revMore` 每次 +200；④ 切「來源序／目標序」後 cap 仍在 20。我方腳本已就緒，不用重寫。

## 五、同期另外兩格的上機結果（都是綠的，先報喜）

- **融視圖**：開關「以科文融合顯示」存在；active db 無 `<融>` 時自動隱藏（`hasFusionTag` 生效）；開啟後 127 個 `.fusionBlock` 殼、**視野內 4 個全部填入真內容**、視野外不填＝V10 如規；庫未開時狀態欄「融視圖：請先開啟 ys.adb（保留原文）」＝V7 如規；關回可逆。
- **缺陷 1／2／3**：我方獨立複驗通過（頁長 349／454／435、`30p793a` 索引 38、三頁 `embedSrc` 全歸「瑜伽師地論」、越界 `j` 鉗到頁尾或回 0 字）。
- 待補的一格：「**ybh 自己的** `<融>` 在 exe 內被填入」目前只有 headless 證據（250/250 可填）——上機那張圖裡被填的是 session 還原出的 `ys.adb`。`D:\accelon3\settings.json` 我方未改動（mtime 仍 11-01 16:15）。

## 六、複測（13:21 版 exe `a995796dab74`，即你們 `04bca4f` 那顆）——缺陷仍在，且已排除我方環境因素

同一趟會話、同一顆 exe，先驗融視圖再點反鏈：

| 格 | 結果 |
|---|---|
| **ybh 自己的 `<融>` 被填入** | **過了**：殼 4 顆、已填 2 顆、其中 `data-i` 以 `ybh?` 開頭者 2 顆，首條 `ybh?T1579-1#kpD02-001` 填入 **141 字**、起頭「論文・C1 五識身相應地2・T1579-1#kpD02-00…」。（你們 `04bca4f`「融合勾選框修好」應有幫助；我方上一輪欠的那格就此補齊，不再列為待驗。） |
| **反鏈** | **仍是 0**：`__revBar={db:taisho,pageId:30p279a#34-40,count:0,srcs:[]}`、`__revPerf={ms:21,n:2403,xrev:false}`、`__xrefPerf.reverse=0`、`__xrefLast={cands:0,hit:0,via:'none'}`、`.xrefRevBar` 不出現、抽屜空。 |

同一環境下一格過、一格不動，**可排除「我的自動化沒關對話框／沒切庫／沒等索引」這類操作因素**——問題在反鏈索引本身。另外 `xrev:false` 與 `n=2403`（我方指 taisho 者 49,749 條）仍是我最在意的兩個數：請先查索引是否只收了部分 `聯`，以及鍵的口徑（`#a-b` 有剝與沒剝）。

重跑方式：本區 `link-audit/tools/test-exe-final.ts`（一支同時驗兩格，約 2 分鐘）；只看反鏈用 `test-exe-r7j.ts`。

— ybh 工作區　2026-11-14（第六節為 13:21 版 exe 複測後補）
