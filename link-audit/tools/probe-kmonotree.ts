#!/usr/bin/env bun
/** 披尋記樹尾段（-k 大綱區）結構驗證：數字根 科漢01 應掛 a* 的 科漢02 子女。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { loadTrees, loadTree, buildTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh.adb'));
const mp = new VaPaMapper(rd); await mp.init();
const trees = await loadTrees(rd);
const rows = await loadTree(rd, trees[2]!, { entryLabelsOnly: false, label: async () => '' });
const roots = buildTree(rows as any);
const cnt = (ns: any[]): number => ns.reduce((s, n) => s + 1 + cnt(n.children ?? []), 0);
console.log('披尋記樹: 根', roots.length, '總節點', cnt(roots), '(=rows?', cnt(roots) === rows.length ? '✓ 全掛樹' : '✗ 掉節點 ' + (rows.length - cnt(roots)) + ')');
// 尾段根（-k 區：最後幾個 科漢01）
const tail = roots.slice(-8);
for (const n of tail) {
  const t = (await mp.lineText(mp.edgeLine(n.va))).replace(/<[^>]*>/g, '').slice(0, 14);
  console.log(`  根 ${n.tag}「${t}」 子女=${(n.children ?? []).length}（${[...new Set((n.children ?? []).map((c: any) => c.tag))].join(',')}）`);
}
