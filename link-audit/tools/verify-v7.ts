#!/usr/bin/env bun
/** v7 驗收：UI 樹路徑不受 錨/節聯 影響；linkToNode 實際解析路徑（anchorVa）對 kp/app 兩式都通。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { anchorVa } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';
import { loadTrees, loadTree, buildTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh-v7.adb'));
const mp = new VaPaMapper(rd); await mp.init();
const trees = await loadTrees(rd);
console.log('樹宣告', trees.length);
const m0 = await loadTree(rd, trees[0]!, { entryLabelsOnly: false, label: async () => '' });
const r0 = buildTree(m0 as any);
console.log('主樹 roots', r0.length, '根標籤', [...new Set(r0.map((n: any) => n.tag))].join(','));

async function jump(a: string) {
  const va = await anchorVa(rd, a);
  if (va == null) { console.log(`  ${a} → null ✗`); return; }
  const raw = await mp.lineText(mp.edgeLine(va));
  console.log(`  ${a} → ${va}｜${raw.slice(0, 48).replace(/\s+/g, ' ')}`);
}
console.log('linkToNode 路徑（anchorVa）：');
await jump('T1579-1#kpD03-001');
await jump('T1828-a#app0311004');
await jump('T1828-a#appstar_0311003-1');
await jump('PXJ-H#kpD03-001');
await jump('T1828-a#app9999999');   // 不存在 → 應 null（warn 路徑）
