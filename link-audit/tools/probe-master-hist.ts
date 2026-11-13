#!/usr/bin/env bun
/** 主樹 rows 的標籤直方圖：誰被多拉進來。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { loadTrees, loadTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh.adb'));
const trees = await loadTrees(rd);
const t = trees[0]!;
console.log('trees[0] tiers:', t.tiers.join(','));
const rows = await loadTree(rd, t, { entryLabelsOnly: false, label: async () => '' });
const hist = new Map<string, number>();
for (const r of rows as any[]) hist.set(r.tag, (hist.get(r.tag) ?? 0) + 1);
const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
console.log('rows', rows.length, '標籤種數', hist.size);
console.log(top.map(([k, v]) => `${k}:${v}`).join(' '));
