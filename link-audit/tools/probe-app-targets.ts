#!/usr/bin/env bun
/** app 引用（出自漢文檔）的目標系列分佈＋定義所在檔是否在庫。 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const WORKS = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','X0794'];
const CN = new Set(WORKS);
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const byTarget = new Map<string, number>();
let total = 0;
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.md')).sort()) {
  const base = f.replace(/\.md$/, '');
  if (!CN.has(seriesOf(base))) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(/\[\[([^\]|#]+)#\^(app[^\s"|\]]+)/g)) {
    total++;
    const tgt = m[1]!.trim();
    const k = (CN.has(seriesOf(tgt)) ? '★入庫 ' : '') + seriesOf(tgt);
    byTarget.set(k, (byTarget.get(k) ?? 0) + 1);
  }
}
console.log('漢文檔 app 引用總數', total);
console.log([...byTarget.entries()].sort((a, b) => b[1]! - a[1]!).slice(0, 12).map(([k, n]) => `  ${k}: ${n}`).join('\n'));
// 入庫目標的定義點形状：T1579-k.md 等有 ^appN_M 行尾錨嗎
for (const w of ['T1579-k', 'PXJ-H-k', 'T1579-1']) {
  const p = path.join(ROOT, w + '.md');
  if (!fs.existsSync(p)) continue;
  const defs = (fs.readFileSync(p, 'utf8').match(/\^app\d+_\d+/g) ?? []).length;
  console.log(`${w}.md 內 ^appN_M 出現 ${defs} 次`);
}
