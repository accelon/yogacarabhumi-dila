#!/usr/bin/env bun
/** v15.4 驗收：每部大綱獨立頁籤的內容（披尋記大綱應 5 根、a* 掛數字根下）。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { loadTrees, loadTree, buildTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh.adb'));
const mp = new VaPaMapper(rd); await mp.init();
const trees = await loadTrees(rd);
console.log('樹總數', trees.length);
const names = trees.map((t: any) => (t.tiers[0] ?? '') + (t.caption ? `(${t.caption})` : ''));
console.log('頁籤首項:', names.slice(0, 4).join(' | '));
const k = trees.findIndex((t: any) => t.tiers[0] === '科大漢01');
console.log('披尋記大綱樹序號:', k);
if (k >= 0) {
  const rows = await loadTree(rd, trees[k]!, { entryLabelsOnly: false, label: async () => '' });
  const roots = buildTree(rows as any);
  const cnt = (ns: any[]): number => ns.reduce((s, n) => s + 1 + cnt(n.children ?? []), 0);
  console.log(`科大漢樹: 根=${roots.length} 節點=${cnt(roots)}/${rows.length}`);
  for (const n of roots.slice(0, 6)) {
    const t = (await mp.lineText(mp.edgeLine(n.va))).replace(/<[^>]*>/g, '').slice(0, 12);
    console.log(`  根 ${n.tag}「${t}」 子女=${(n.children ?? []).length}`);
  }
}
