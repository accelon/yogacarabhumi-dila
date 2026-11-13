#!/usr/bin/env bun
/** v15.1 結構複驗：總目錄樹嵌套（17 書>卷次）、錨點解析、標籤往返。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { loadTrees, loadTree, buildTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';
import { anchorVa, nodeAnchorInfo } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh.adb'));
const mp = new VaPaMapper(rd); await mp.init();
const trees = await loadTrees(rd);
const roots = buildTree(await loadTree(rd, trees[0]!, { entryLabelsOnly: false, label: async () => '' }) as any);
const cnt = (ns: any[]): number => ns.reduce((s, n) => s + 1 + cnt(n.children ?? []), 0);
console.log(`總目錄: 根=${roots.length}（期望17）總節點=${cnt(roots)}（期望377）`);
console.log('首根標籤:', roots[0]?.tag, '子女標籤:', roots[0]?.children?.[0]?.tag, '孫:', roots[0]?.children?.[0]?.children?.length ?? 0);
const a1 = await anchorVa(rd, 'T1579-1#kpD03-001');
const a2 = await nodeAnchorInfo(rd, 'PXJ-H#kpD03-001');
const line = a1 != null ? await mp.lineText(mp.edgeLine(a1)) : '';
console.log('卷級錨 T1579-1#kpD03-001 →', a1, line.includes('n="kpD03-001"') ? '行✓' : '行✗');
console.log('篇級錨 PXJ-H#kpD03-001 →', a2 ? a2.va : 'null', a2 ? a2.tag : '');
const l3 = await mp.lineText(mp.edgeLine((await anchorVa(rd, 'T1579-1'))!));
console.log('卷次行:', l3.slice(0, 46));
