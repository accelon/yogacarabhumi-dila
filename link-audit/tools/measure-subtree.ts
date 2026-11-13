#!/usr/bin/env bun
/** 科判子樹行距分佈（為 <嵌 sub="1"> 的 maxLines 給實據）：tier=科NN，行距＝到下一「同層或更淺」標題。 */
import fs from 'node:fs';
const lines = fs.readFileSync('D:/2026/_scratch-ybh/ybh/ybh.xml', 'utf8').split('\n');
type H = { i: number; tier: number };
const hs: H[] = [];
for (let i = 0; i < lines.length; i++) {
  const m = /^<科(\d\d)/.exec(lines[i]!);
  if (m) hs.push({ i, tier: +m[1]! });
}
console.log('科判標題', hs.length);
const dist: number[] = [];
for (let k = 0; k < hs.length; k++) {
  const h = hs[k]!;
  let end = lines.length;
  for (let j = k + 1; j < hs.length; j++) {
    if (hs[j]!.tier <= h.tier) { end = hs[j]!.i; break; }
  }
  dist.push(end - h.i);
}
dist.sort((a, b) => a - b);
const pct = (p: number) => dist[Math.min(dist.length - 1, Math.floor(dist.length * p))];
console.log(`子樹行距：中位 ${pct(0.5)}｜p90 ${pct(0.9)}｜p99 ${pct(0.99)}｜p99.9 ${pct(0.999)}｜max ${dist[dist.length - 1]}`);
console.log(`超過 60 行的比例：${(100 * dist.filter((x) => x > 60).length / dist.length).toFixed(1)}%｜超過 200：${(100 * dist.filter((x) => x > 200).length / dist.length).toFixed(1)}%｜超過 400：${(100 * dist.filter((x) => x > 400).length / dist.length).toFixed(2)}%`);

// 死錨清單（v4 仍留文字的那些 kpD 引用、目標卷未定義）——給 DILA 端
const ROOT = 'D:/2026/yogacarabhumi-dila';
const WORKS = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','X0794'];
const CN = new Set(WORKS);
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const defined = new Set<string>();
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.md'))) {
  const base = f.replace(/\.md$/, '');
  if (!CN.has(seriesOf(base))) continue;
  for (const m of fs.readFileSync(ROOT + '/' + f, 'utf8').matchAll(/^#{1,6} .*?\^(kpD\d+-\d+)\s*$/gm)) defined.add(`${base}#${m[1]}`);
}
const dead = new Map<string, number>();
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.md'))) {
  const base = f.replace(/\.md$/, '');
  if (!CN.has(seriesOf(base))) continue;
  const t = fs.readFileSync(ROOT + '/' + f, 'utf8');
  for (const m of t.matchAll(/\[\[([^\]|#]+)#\^(kpD\d+-\d+)/g)) {
    const tgt = m[1].trim();
    if (!CN.has(seriesOf(tgt))) continue;
    if (!defined.has(`${tgt}#${m[2]}`)) dead.set(`${tgt}#${m[2]}`, (dead.get(`${tgt}#${m[2]}`) ?? 0) + 1);
  }
}
const rows = [...dead.entries()].sort((a, b) => b[1]! - a[1]!).map(([k, n]) => `${k}\t${n}`);
fs.writeFileSync('D:/2026/_scratch-ybh/dead-anchors.tsv', ['target#anchor\tref_count', ...rows].join('\n'));
console.log(`死錨種類 ${dead.size}、引用實例 ${rows.reduce((s, r) => s + +r.split('\t')[1], 0)} → _scratch-ybh/dead-anchors.tsv`);
