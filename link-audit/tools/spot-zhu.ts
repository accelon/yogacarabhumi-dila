#!/usr/bin/env bun
/**
 * 語意抽檢（分層抽樣）：對已採纳的段落 ref，取回窗文字，並列「段前 30 字／所在科判→窗來源科判／窗首 24 字」，
 * 供人工判斷「這段注文是否真在釋這段論文」。座標正確性由 verify-zhu-refs 全條負責，這裡只看語意。
 */
import fs from 'node:fs';
const el = () => ({ style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, after() {}, insertBefore() {} });
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' }; g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; g.CSS = { highlights: new Map() };
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');

const SER = process.argv[2] ?? 'T1829';
const N = +(process.argv[3] ?? 24);
const han = (x: string) => x.replace(/[^一-鿿]/g, '');
const trd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));

type R = { base: string; line: number; kp: string; page: string; js: number; je: number; mode: string; quote: string };
const rows: R[] = [];
for (const ln of fs.readFileSync(`D:/2026/_scratch-ybh/zhu-refs-${SER}.tsv`, 'utf8').split('\n').slice(1)) {
  const c = ln.split('\t');
  if (c.length < 8 || !c[3]) continue;
  rows.push({ base: c[0]!, line: +c[1]!, kp: c[2]!, page: c[3]!, js: +c[4]!, je: +c[5]!, mode: c[6]!, quote: c[7] ?? '' });
}
const csv = fs.readFileSync(`D:/2026/_scratch-ybh/zhu-refs-${SER}-review.csv`, 'utf8').replace(/^/, '').split('\r\n');
const textOf = new Map<string, string>();
for (const ln of csv.slice(1)) {
  const m = ln.match(/^"([^"]*)","(\d+)","([^"]*)","([^"]*)","(-?\d+)","(-?\d+)","([^"]*)","([^"]*)","([^"]*)","([^"]*)"$/);
  if (m) textOf.set(`${m[1]}#${m[2]}`, m[10]!);
}
// 分層：按卷檔輪取，共 N 條
const byBase = new Map<string, R[]>();
for (const r of rows) { const a = byBase.get(r.base) ?? []; a.push(r); byBase.set(r.base, a); }
const bases = [...byBase.keys()].sort((a, b) => +/-(\d+)$/.exec(a)![1]! - +/-(\d+)$/.exec(b)![1]!);
const picks: R[] = [];
for (let k = 0; picks.length < N; k++) {
  for (const b of bases) {
    const a = byBase.get(b)!;
    const idx = Math.floor((k / Math.max(1, N)) * a.length) % a.length;
    const r = a[idx]!;
    if (!picks.includes(r)) { picks.push(r); if (picks.length >= N) break; }
  }
}
for (const r of picks) {
  const res = await renderEmbed('taisho', r.page, '', `${r.js}-${r.je}`, '', false, trd as any);
  const mark = han(/<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '');
  console.log(`[${r.mode}] ${r.base}:${r.line} 段「${textOf.get(`${r.base}#${r.line}`) ?? ''}」`);
  console.log(`      錨 ${r.page}#${r.js}-${r.je} ← ${r.quote.slice(0, 40)}`);
  console.log(`      窗「${mark.slice(0, 34)}」\n`);
}
