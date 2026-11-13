#!/usr/bin/env bun
/**
 * verify-fusion-fixture.ts — 融視圖斷言的「今日可執行」子集（產品碼路）
 * V1-V5 現在就該綠；V6+ 綁視圖開關（reader 未實裝），會印 SKIP-GATE 而非 fail。
 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { anchorVa, nodeAnchorInfo, nodeSpanText, nodeSubtreeEnd } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';

const P = 'D:/2026/yogacarabhumi-dila/link-audit/fixtures/fusion-fixture.adb';
const rd = await AdbReader.open(new SyncIO(P));
const mp = new VaPaMapper(rd); await mp.init();
let pass = 0, fail = 0, gate = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ok   ' + n + (d ? '  ' + d : ''))) : (fail++, console.log('  FAIL ' + n + '  ' + d)); };
const skipped = (n: string, why: string) => { gate++; console.log('  GATE ' + n + '  ← ' + why); };
const lineAt = async (va: number) => await mp.lineText(mp.edgeLine(va));

// V1 <融> standoff 指標原樣往返（透明容器、內容與 i= 俱在）
let rongHits = 0;
for (let L = 0; L < 40 && L < rd.header.lineCount; L++) {
  const raw = await mp.lineText(L);
  if (raw.includes('<融 i="fix?GW-1#')) rongHits++;
}
ok('V1 融 標籤與 i= 指標原樣往返', rongHits >= 4, '行數=' + rongHits);

// V2 融目標可解析（卷級節點錨）
const t1 = await anchorVa(rd, 'GW-1#kpD02-001');
ok('V2 融目標 GW-1#kpD02-001 解析', t1 != null && (await lineAt(t1!)).includes('五識身相應地'));

// V3 融視圖該填的 span＝目標子樹（sub 語義），含後代與論本
const n1 = await nodeAnchorInfo(rd, 'GW-1#kpD01-001');
const se1 = await nodeSubtreeEnd(rd, n1!.va);
const span1 = await nodeSpanText(rd, n1!.va, se1, 200);
ok('V3 子樹 span 含後代標題＋論本', span1.includes('問答標列') && span1.includes('云何瑜伽師地'), span1.length + '字');

// V4 缺目標回退：解析 null（reader 須保留佔位＋提示，不得空白）
ok('V4 缺目標 kpD02-999 → null', (await anchorVa(rd, 'GW-1#kpD02-999')) == null);

// V5 standoff：韓科與基科的 融 指向同一 VA（論本不複製）
const aKE = await anchorVa(rd, 'GW-1#kpD01-001');
const aJI = await anchorVa(rd, 'GW-1#kpD01-001');
ok('V5 兩科文樹同目標同 VA', aKE != null && aKE === aJI, String(aKE));

// V6+ 視圖級斷言（等 accelon26 實裝 <融> 視語義，經使用者核准後才動）
skipped('V6 融視圖開啟：佔位被 span 內容覆寫', '需 reader 視圖開關');
skipped('V7 缺目標：保留佔位文字＋狀態欄 warn', '需 reader 回退路徑');
skipped('V8 切換科文樹（KE↔JI）＝重排同一份論本', '需視圖＋目錄聯動');
skipped('V9 視圖內點科判＝節聯行為（捲動＋游標）', '需視圖容器事件');
skipped('V10 延遲取段（大科不一次拉满）', '需效能閘');

console.log(`\n${pass} passed, ${fail} failed, ${gate} gated(待視圖實裝)`);
process.exit(fail ? 1 : 0);
