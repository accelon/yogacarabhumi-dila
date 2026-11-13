#!/usr/bin/env bun
/**
 * 回函論據審計：kpD「卷級 vs 篇級」命名空間的強度證明。
 * 只用標題行「定義」（^#{1,6} ... ^kpD..\s*$），文內引用不計；360 入庫檔全掃。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = 'D:/2026/yogacarabhumi-dila';
const WORKS = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','X0794'];
const CN = new Set(WORKS);
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];

const defRe = /^#{1,6} .*?\^(kpD\d+-\d+)\s*$/gm;
const refRe = /\[\[([^\]|#]+)#\^(kpD\d+-\d+)/g;

const serKp = new Map<string, Map<string, string[]>>();   // ser → kp → [bases 定義序]
const dupPerFile: string[] = [];
let defs = 0;
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.md')).sort();
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const ser = seriesOf(base);
  if (!CN.has(ser)) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const seen = new Map<string, number>();
  for (const m of t.matchAll(defRe)) {
    defs++;
    seen.set(m[1], (seen.get(m[1]) ?? 0) + 1);
    const mm = serKp.get(ser) ?? new Map<string, string[]>();
    const arr = mm.get(m[1]) ?? [];
    if (!arr.includes(base)) arr.push(base);
    mm.set(m[1], arr);
    serKp.set(ser, mm);
  }
  for (const [kp, n] of seen) if (n > 1) dupPerFile.push(`${base}:${kp}×${n}`);
}
// 篇級撞號統計
let pairs = 0, collide = 0, maxVol = 0, maxKey = '';
for (const [ser, m] of serKp) for (const [kp, bases] of m) {
  pairs++;
  if (bases.length > 1) { collide++; if (bases.length > maxVol) { maxVol = bases.length; maxKey = `${ser}#${kp}`; } }
}
console.log(`定義總數 ${defs}｜(著作,kp) 種 ${pairs}｜跨卷撞號 ${collide}＝${(100 * collide / pairs).toFixed(1)}%｜最大跨卷數 ${maxVol}（${maxKey}）`);
console.log(`同卷內重複定義：${dupPerFile.length ? dupPerFile.slice(0, 10).join(' ') : '零'}`);
// 引用實例層面的影響：若改篇級，有多少引用會落在非首定義卷
let refs = 0, refsSafe = 0, refsUnsafe = 0, refsBadExample = '';
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const ser = seriesOf(base);
  if (!CN.has(ser)) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(refRe)) {
    const tgt = m[1].trim();
    if (!CN.has(seriesOf(tgt))) continue;
    refs++;
    const first = serKp.get(seriesOf(tgt))?.get(m[2]);
    if (!first) continue;
    if (first.length === 1) refsSafe++;
    else if (tgt !== first[0]) { refsUnsafe++; if (!refsBadExample) refsBadExample = `${base} 引用 ${tgt}#^${m[2]}（篇級會落到 ${first[0]}）`; }
    else refsSafe++; // 撞號但目標恰是首卷——僥倖正確
  }
}
console.log(`庫內 kp 引用實例 ${refs}：篇級化後仍對 ${refsSafe}｜錯指 ${refsUnsafe}＝${(100 * refsUnsafe / refs).toFixed(1)}%`);
console.log(`錯指例：${refsBadExample}`);
// 回函引用的三個例子，嚴格重驗
for (const [ser, kp] of [['T1579','kpD03-001'],['T1579','kpD17-014'],['T1829','kpD17-014'],['PXJ-H','kpD03-001'],['T1579','kpD14-020']]) {
  console.log(`${ser}#${kp} 定義卷：`, (serKp.get(ser)?.get(kp) ?? []).join(',') || '無');
}
