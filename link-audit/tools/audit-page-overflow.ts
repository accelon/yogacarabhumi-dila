#!/usr/bin/env bun
/**
 * 母區 09d4625 修好 pageHanTextOf 之后的連帶盤點：我們**舊資料里的 j 窗是按「越頁 bleeding 座標」算的**，
 * 現在頁字串被截到頁尾，凡是 `je` 超過該頁真實長度的窗都會被產品鉗製（mark 变短）。
 * 本腳本量化三張表各有多少越界窗、鉗製後还剩多少字，供決定是否統一縮 je。
 *   ① spans-j-verified.tsv（科判行窗，T1579＋披尋記 26,066 條）
 *   ② zhu-refs-*.tsv（注文段落窗）
 *   ③ ybh 實際入庫清單 zhu-refs-shipped.tsv
 */
import fs from 'node:fs';
const el = () => ({ style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, after() {}, insertBefore() {} });
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' }; g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; g.CSS = { highlights: new Map() };
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { pageHanTextOf } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const SCR = 'D:/2026/_scratch-ybh';
const lenCache = new Map<string, number>();
async function len(p: string): Promise<number> {
  let v = lenCache.get(p);
  if (v === undefined) { v = (await pageHanTextOf(rd, p)).length; lenCache.set(p, v); }
  return v;
}
async function scan(name: string, rows: [string, number, number][], lineNo: (r: [string, number, number]) => string) {
  let over = 0, dead = 0, shortTail = 0;
  const ex: string[] = [];
  for (const [p, js, je] of rows) {
    if (!p || je <= 0) continue;
    const L = await len(p);
    if (je > L) {
      over++;
      const tail = L - js;
      if (tail <= 0) dead++;
      else if (tail < 6) shortTail++;
      else if (ex.length < 3) ex.push(lineNo([p, js, je]) + ` → 鉗製後 ${tail} 字`);
    }
  }
  console.log(`${name}：窗 ${rows.length} 條｜越界 ${over}（其中整窗在頁外 ${dead}、鉗後剩 <6 字 ${shortTail}）`);
  if (ex.length) console.log('   可救樣本：' + ex.join('；'));
}
const v1: [string, number, number][] = [];
for (const l of fs.readFileSync(`${SCR}/spans-j-verified.tsv`, 'utf8').split('\n').slice(1)) {
  const c = l.split('\t');
  if (c.length >= 6 && c[3] && c[4] !== '' && c[5] !== '') v1.push([c[3]!, +c[4]!, +c[5]!]);
}
await scan('① spans-j-verified（科判行窗）', v1, (r) => r[0] + '#' + r[1] + '-' + r[2]);
for (const f of fs.readdirSync(SCR).filter((x) => /^zhu-refs-.+\.tsv$/.test(x) && !/shipped|pre-refine/.test(x)).sort()) {
  const rows: [string, number, number][] = [];
  for (const l of fs.readFileSync(`${SCR}/${f}`, 'utf8').split('\n').slice(1)) {
    const c = l.split('\t');
    if (c.length >= 8 && c[3] && +c[4]! >= 0) rows.push([c[3]!, +c[4]!, +c[5]!]);
  }
  if (rows.length) await scan('② ' + f, rows, (r) => r[0] + '#' + r[1] + '-' + r[2]);
}
