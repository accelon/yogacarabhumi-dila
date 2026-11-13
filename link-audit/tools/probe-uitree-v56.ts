#!/usr/bin/env bun
/** UI 同款路徑（loadTrees→loadTree→buildTree）對照 v5/v6：根數、根標籤、深度。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { loadTrees, loadTree, buildTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const count = (ns: any[]): number => ns.reduce((s, n) => s + 1 + count(n.children ?? []), 0);
const depth = (ns: any[], d = 1): number => ns.reduce((m, n) => Math.max(m, depth(n.children ?? [], d + 1)), d);

for (const v of ['v5', 'v6']) {
  const rd = await AdbReader.open(new SyncIO(`D:/accelon3/ybh-${v}.adb`));
  const trees = await loadTrees(rd);
  console.log(`\n== ybh-${v}：${trees.length} 棵樹宣告 ==`);
  const picks = [0, 1, 4];   // 主樹、披尋記、略纂
  for (const ti of picks) {
    const t = trees[ti]!;
    const insts = await loadTree(rd, t, { entryLabelsOnly: false, label: async () => '' });
    const roots = buildTree(insts as any);
    const rootTags = [...new Set(roots.map((r: any) => r.tag))].join(',');
    console.log(`  樹#${ti}（${t.tiers[0]}…${t.tiers.at(-1)}）: 實例=${insts.length} roots=${roots.length} 根標籤=[${rootTags.slice(0, 40)}] 樹節點=${count(roots)} 深度=${depth(roots) - 1}`);
  }
}
