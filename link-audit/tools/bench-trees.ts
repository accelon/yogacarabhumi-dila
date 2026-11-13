#!/usr/bin/env bun
/** R5 基線：ybh.adb 17 棵樹的 loadTrees/loadTree/buildTree 分段計時（產品碼路）。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { loadTrees, loadTree, buildTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh.adb'));
let t = Date.now();
const trees = await loadTrees(rd);
const tTrees = Date.now() - t;
console.log(`trees: ${trees.length} 棵，宣告掃描 ${tTrees} ms`);
let load = 0, build = 0, inst = 0, nodes = 0;
const per: string[] = [];
for (let i = 0; i < trees.length; i++) {
  const tr = trees[i]!;
  let t2 = Date.now();
  const rows = await loadTree(rd, tr, { entryLabelsOnly: true, label: async () => '' });
  const tl = Date.now() - t2; t2 = Date.now();
  const roots = buildTree(rows as any);
  const tb = Date.now() - t2;
  const cnt = (function c(ns: any[]): number { return ns.reduce((s, n) => s + 1 + c(n.children ?? []), 0); })(roots);
  load += tl; build += tb; inst += rows.length; nodes += cnt;
  per.push(`#${i} ${String(tr.tiers[0]).padEnd(6)} rows=${String(rows.length).padStart(6)} load=${String(tl).padStart(6)}ms build=${String(tb).padStart(6)}ms nodes=${cnt}`);
}
console.log(per.slice(0, 3).join('\n'));
console.log('  …');
console.log(per.filter((x) => +(/rows=\s*(\d+)/.exec(x)?.[1] ?? 0) > 5000).join('\n') || '');
console.log(`合計: load ${load} ms｜build ${build} ms｜rows ${inst}｜nodes ${nodes}`);
console.log(`若只建主樹(#0): load/build ≈ ${(/#0 .*load=\s*(\d+)ms build=\s*(\d+)ms/.exec(per[0]!)?.[1] ?? '?')} / ${(/#0 .*load=\s*(\d+)ms build=\s*(\d+)ms/.exec(per[0]!)?.[2] ?? '?')} ms`);
