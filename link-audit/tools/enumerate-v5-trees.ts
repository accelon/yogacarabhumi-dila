#!/usr/bin/env bun
/** 驗證 ybh v5：loadTrees 回幾棵？每棵節點數/最大深度/根標籤；家族樹是否各自獨立。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { loadTrees, loadTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh-v5.adb'));
const trees = await loadTrees(rd);
console.log('樹宣告數：', trees.length);
const summary: string[] = [];
for (const t of trees) {
  const nodes = (await loadTree(rd, t as any)) as any[];
  const depth = nodes.reduce((m, n) => Math.max(m, n.depth ?? 0), 0);
  const rootTags = [...new Set(nodes.filter((n) => (n.depth ?? 0) === 0).map((n) => n.tag))];
  const tagSet = [...new Set(nodes.map((n) => n.tag))].sort();
  summary.push(`  「${(t as any).caption ?? '?'}」tiers=${t.tiers.length}(${t.tiers[0]}…${t.tiers.at(-1)}) 節點=${nodes.length} maxDepth=${depth} 根標籤=${rootTags.join(',') || '(無)'}`);
  // 家族純度：這棵樹用到的 科* 標籤是否同一家族
  const keTags = tagSet.filter((x: string) => x.startsWith('科'));
  const fams = new Set(keTags.map((x: string) => x.replace(/\d\d$/, '')));
  if (fams.size > 1) summary.push(`     ⚠ 混家族：${[...fams].join(',')}`);
}
console.log(summary.join('\n'));
