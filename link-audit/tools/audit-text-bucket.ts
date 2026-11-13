#!/usr/bin/env bun
/** 細分 build 的 textCnt 102,916 到底是什麼構成的（照 inline() 同分流）。 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const WORKS = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','X0794'];
const CN = new Set(WORKS);
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const defRe = /^#{1,6} .*?\^(kpD\d+-\d+)\s*$/gm;
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.md')).sort();
const serKp = new Map<string, Map<string, string[]>>();
for (const f of files) {
  const base = f.replace(/\.md$/, ''); const ser = seriesOf(base);
  if (!CN.has(ser)) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  const mm = serKp.get(ser) ?? new Map<string, string[]>();
  for (const m of t.matchAll(defRe)) { const arr = mm.get(m[1]) ?? []; if (!arr.includes(base)) arr.push(base); mm.set(m[1], arr); }
  serKp.set(ser, mm);
}
const cat = { embed_unique: 0, collide_first: 0, collide_notfirst: 0, undef_kp: 0, nonCN: 0, app_anchor: 0, other_anchor: 0, no_anchor: 0 } as Record<string, number>;
const collideSamples: string[] = []; const undefSamples: string[] = []; const notFirst: string[] = [];
for (const f of files) {
  const base = f.replace(/\.md$/, ''); const ser = seriesOf(base);
  if (!CN.has(ser)) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(/\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|[^\]]*)?\]\]/g)) {
    const tgt = m[1].trim(); const anchor = (m[2] || '').replace(/^\^/, '').trim();
    const tSer = seriesOf(tgt);
    if (!anchor) { cat.no_anchor++; continue; }
    if (!/^kpD\d+-\d+$/.test(anchor)) { /app/.test(anchor) ? cat.app_anchor++ : cat.other_anchor++; continue; }
    if (!CN.has(tSer)) { cat.nonCN++; continue; }
    const vols = serKp.get(tSer)?.get(anchor);
    if (!vols) { cat.undef_kp++; if (undefSamples.length < 5) undefSamples.push(`${base}→${tgt}#${anchor}`); continue; }
    if (vols.length === 1) { cat.embed_unique++; continue; }
    if (tgt === vols[0]) cat.collide_first++; else { cat.collide_notfirst++; if (notFirst.length < 5) notFirst.push(`${base}→${tgt}#${anchor}（首定義在 ${vols[0]}）`); }
    if (collideSamples.length < 6) collideSamples.push(`${base}→${tgt}#${anchor}｜卷清单 ${vols.join(',')}`);
  }
}
console.log(JSON.stringify(cat));
console.log('撞號引用例：\n ' + collideSamples.join('\n '));
console.log('撞號但目標＝首卷以外：\n ' + (notFirst.join('\n ') || '零'));
console.log('引用了但全書無此定義（死錨）例：\n ' + undefSamples.join('\n '));
