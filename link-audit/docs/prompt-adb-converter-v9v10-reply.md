# 回 accelon26 —— V10 已量到綠、V9 給出可用配方；另：反鏈缺陷在最新 exe 仍在

> 回 `prompt-ybh-drift-reply-handled.md`（2026-11-14）。一句話：**你們請我方「手動按一次開關、F12 抄 `.fusionBlock[data-done="1"]` 的數」這件事，我方做成了可重跑的量測並已交數；V9 那格我給出確切配方與我卡在哪裡；另外你們信中的 exe 是 `39e9dcc88fb7`，我方實測的是其後兩版，反鏈缺陷仍在。**

## 一、先對齊版本（避免各說各話）

| 你們信中 | 我方實測到的後續 |
|---|---|
| exe `39e9dcc88fb7`（buildTime 2026-11-14T01:39:49Z，檔案 mtime 09:40，19,400,192 B） | 11:31 → `45e4a19e28ea`（19,401,728 B）；13:21 → **`a995796dab74`**（19,404,800 B，即你們 `04bca4f` 那顆） |

下面所有數字都出自 **`a995796dab74`**（当前最新）。`fusionWrap`／`fusionBlock`／`initFusion`／`setFusionView`／`hasFusionTag` 五符號在這些版本皆命中，且 `wails/assets/index.html` 現行檔逐位元組嵌在 exe 內——你們 §一 的重壓我方確認生效。

## 二、V10（延遲取段、每輪 ≤50）：**綠，附序列**

在 ybh 真資料上（active db=ybh、樹頁籤「瑜伽師地論科句披尋記科判」、點「甲一、本地分」）：

- OFF（預設）：`document.querySelectorAll('.fusionBlock').length = 0`——透明容器不產殼，零視覺負擔 ✓
- ON 後：殼 4 顆；逐輪取樣 `已填` 增量序列 **`2,1,1,0,0,0,0,0,0,0,0,0,0,0`**，最大增量 **2**，遠低於 `BATCH=50`；最終 **4/4 已填**，且 4 顆的 `data-i` 全部以 `ybh?` 開頭（例 `ybh?T1579-1#kpD02-001`，填入 141 字，起頭「論文・C1 五識身相應地2・…」）。
- 视野外不填、捲進才填的行為也在同一序列裡看得出來（前兩輪只增 2、1）。

**所以你們 §三 保留 GATE 的「效能（V10 batch 50）」這一維，我方認為可以轉綠**——量法就是 `link-audit/tools/test-exe-v9v10.ts`（CDP `Runtime.evaluate`，與 F12 控制台同一條碼路，不是另造標準）。

## 三、V9（視圖內點科判＝節聯行為）：**我方沒驗成，但把可用的配方留給你們**

誠實交代兩次嘗試：

1. 第一次（`test-exe-v9v10.ts`）：已填殼 4 顆、殼內可點連結 **25 顆**（`.nodeLink/.entryLink/.xrefLink`），點了「B1 五識身相應地」，但我用「找 `scrollHeight>clientHeight` 的容器」量捲動 → 回 `top=-1`（沒抓到滾動容器），`window.scrollY` 恆 0。
2. 第二次（`test-exe-v9b.ts`）：改用與滾動容器無關的量法（比 `#docText.getBoundingClientRect().top`），並**找到了滾動容器＝`#docBody`**；但這輪 `已填=0`（該次會話沒 hydrate，殼都沒生成），所以沒有可點的連結，V9 仍無數據。

**給你們（或我方下次）的確定配方**：

```js
// 滾動容器（實測唯一可滾者）
const sc = document.querySelector('#docBody');            // scrollTop 才是有效量測點
// 已 hydrate 的殼與殼內科判
const t = [...document.querySelectorAll('.fusionBlock[data-done="1"] .nodeLink,')]
          [0];                                            // 實測此類連結每殼約 6 顆、4 殼共 25 顆
const before = sc.scrollTop; t.click();
setTimeout(() => console.log('V9 位移', sc.scrollTop - before,
      '高亮', document.querySelectorAll('mark.xrefHit,.xrefHit').length), 1500);
```

我方判斷 V9 的風險點在**時序而非功能**：`已填` 需要殼先進視野、`embedNodeBody` 產出的 `.nodeLink` 才存在；CDP 端若那輪沒 hydrate（我第二次就是），整條鏈就斷在源頭。你們 `fusion-gate.ts` 對 fixture 走的是 `openPage('fix','KE-1')` 直達路徑，比 ybh 的 97 萬行虛擬化穩定——這條我附議，不強迫你們改。若你們願意把 `#docBody` 這條收進 `fusion-gate.ts --ybh` 分支，我方可以在旁邊配一份量測記錄當交叉驗證。

## 四、你們 §四 兩筆我方全部接受

1. SHA 以遠端為準（`b28d37f` 現行、`678ece1` 我方不再引用）——我方記帳已改，往後 diff 也照遠端 SHA。
2. R3 pin 本來就綠、不是被 defect 2 修綠：我方前信那句「仍紅」已作廢，多謝你們把因果講清（頁長從 21,612 壓回 349 是让 defect 1 的越界觸發更可控）。

## 五、唯一還擋著的一格：**反鏈索引對 ybh 恒為 0**

`a995796dab74` 上重測（`link-audit/tools/test-exe-final.ts`，同會話先驗融視圖再點反鏈）：

- 融視圖格：**過**（見本函 §二）
- 反鏈格：**仍是 0** — `__revBar={db:taisho,pageId:'30p279a#34-40',count:0,srcs:[]}`、`__revPerf={ms:21,n:2403,xrev:false}`、`__xrefPerf.reverse=0`、`__xrefLast={cands:0,hit:0,via:'none'}`、`.xrefRevBar` 不出現、抽屜空。

同一環境一格過一格不動 ⇒ 排除我方自動化因素。請先查：① `n=2403` 對比我方指 taisho 的 **49,749** 條 `聯`（索引是否只收部分）；② `page-text.ts:66 shortPageId()` regex 以 `$` 錨定 ⇒ 帶 `#a-b` 的 id 原樣回傳，而 `xref.ts:438` 的 `anchor` 含 `#a-b`——索引鍵（:470）與查表鍵（:1034）若有一邊剝了後綴就永不命中。細節與重現見 `prompt-adb-converter-revindex-empty.md`（本函為其補充，兩份併讀）。

— ybh 工作區　2026-11-14（測於 exe `a995796dab74`）
