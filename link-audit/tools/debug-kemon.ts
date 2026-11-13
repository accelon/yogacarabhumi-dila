#!/usr/bin/env bun
/** 逐段調試 kemon 匹配：報告 PXJ-H-1.md 鏈行匹配/漏配原因。 */
import fs from 'node:fs';
const t = fs.readFileSync('D:/2026/yogacarabhumi-dila/PXJ-H-1.md', 'utf8').replace(/\r\n?/g, '\n');
const lines = t.split('\n');
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const tierOfChar = (c: string) => { const g = GAN.indexOf(c); return g >= 0 ? g + 1 : ZHI.indexOf(c) + 11; };
function cnParse(x: string): number {
  const U = '一二三四五六七八九';
  if (x === '十') return 10;
  let m = /^十(.)$/.exec(x); if (m) return 10 + U.indexOf(m[1]!) + 1;
  m = /^(.)十(.?)$/.exec(x); if (m) { const a = U.indexOf(m[1]!) + 1; return a * 10 + (m[2] ? U.indexOf(m[2]!) + 1 : 0); }
  return U.indexOf(x) + 1;
}
const hd = new Map<string, string>();
for (const ln of lines) {
  const hm = /^(#{1,6})\s+(.*)$/.exec(ln);
  if (!hm) continue;
  const am = /\^(kpD(\d+)-(\d+))/.exec(hm[2]!);
  if (!am) continue;
  const title = hm[2]!.replace(/\s*\^kpD\d+-\d+\s*$/, '').replace(/\^kp#[^\s（]*/g, '').trim().replace(/^[A-Z]?\d*\s*/, '');
  hd.set(`${+am[2]!}-${+am[3]!}`, title);
}
let hit = 0, missTitle = 0, noHd = 0, badNum = 0, total = 0;
const missSamples: string[] = [];
for (const ln of lines) {
  if (/^#/.test(ln) || /^\[\^/.test(ln) || /^《/.test(ln)) continue;
  for (const seg of ln.split('　')) {
    const m = /^([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])([一二三四五六七八九十]{1,3})、(.*)$/.exec(seg.trim());
    if (!m) continue;
    total++;
    const tier = tierOfChar(m[1]!);
    const seq = cnParse(m[2]!);
    if (!seq) { badNum++; continue; }
    const key = `${tier}-${seq}`;
    const title = hd.get(key);
    if (title === undefined) { noHd++; if (missSamples.length < 6) missSamples.push(`無標題 ${key} ← ${seg.slice(0, 28)}`); continue; }
    const rest = m[3]!.trim();
    if (title && rest.startsWith(title)) hit++;
    else { missTitle++; if (missSamples.length < 10) missSamples.push(`標題不合 hd「${title}」vs 文「${rest.slice(0, 20)}」`); }
  }
}
console.log(`鏈段總數 ${total}：命中 ${hit}、無對應標題 ${noHd}、漢數解析失敗 ${badNum}、標題文字不合 ${missTitle}`);
console.log(missSamples.join('\n'));
