#!/usr/bin/env bun
/** 鏡像驗證：每部 -k 標題序 vs 主卷標題序，位置對齊＋正規化標題吻合率。 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const WORKS = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','X0794'];
const CN = new Set(WORKS);
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const norm = (s: string) => s
  .replace(/\^kp[#A-Za-z0-9_-]+/g, '')
  .replace(/^\s*(?:[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥][一二三四五六七八九十]{1,3}、|[A-Za-z][0-9]*[ .、]?)/, '')
  .replace(/[0-9０-９\s　、，。：；（）()·「」『』?？]/g, '').slice(0, 10);

const all = fs.readdirSync(ROOT).filter((f) => f.endsWith('.md'));
console.log('著作      主卷標題  大綱標題  吻合率   備註');
for (const ser of WORKS) {
  const mains = all.filter((f) => { const b = f.replace(/\.md$/, ''); return seriesOf(b) === ser && !/-k$/.test(b) && !/-a$/.test(b); })
    .sort((a, b) => +(/-(\d+)\.md$/.exec(a)?.[1] ?? 0) - +(/-(\d+)\.md$/.exec(b)?.[1] ?? 0));
  const kf = all.find((f) => new RegExp(`^${ser.replace(/[-]/g, '\\-')}-k\\.md$`).test(f));
  if (!kf) { console.log(`${ser.padEnd(9)} (無 -k)`); continue; }
  const mainT: string[] = [];
  for (const f of mains) for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(/^#{1,6}\s+(.*)$/gm)) mainT.push(norm(m[1]!));
  const kT: string[] = [];
  for (const m of fs.readFileSync(path.join(ROOT, kf), 'utf8').matchAll(/^#{1,6}\s+(.*)$/gm)) kT.push(norm(m[1]!));
  let same = 0;
  const n = Math.min(mainT.length, kT.length);
  for (let i = 0; i < n; i++) if (mainT[i] && mainT[i] === kT[i]) same++;
  const rate = n ? (100 * same / n).toFixed(1) : '—';
  console.log(`${ser.padEnd(9)} ${String(mainT.length).padStart(7)} ${String(kT.length).padStart(8)}  ${String(rate).padStart(6)}%  ${mainT.length === kT.length ? '等長' : '長度差 ' + (kT.length - mainT.length)}`);
}
