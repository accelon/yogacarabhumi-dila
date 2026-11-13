#!/usr/bin/env bun
/** j 對位驗收：抽樣 renderEmbed('taisho', page, '', 'jstart-jend') 應含該 span 的起句。 */
import fs from 'node:fs';
installDomShim();
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));

function installDomShim(): void {
  const el = () => ({
    style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, after() {}, insertBefore() {},
  });
  const g = globalThis as any;
  g.window = { addEventListener() {}, setTimeout: (f: any) => f && 0, location: { href: '' } };
  g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
  g.navigator = { userAgent: 'test' };
  g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  g.CSS = { highlights: new Map() };
}

const quoteOf = new Map<string, string>();
for (const f of ['spans-t1579.tsv', 'spans-pxj.tsv']) {
  for (const r of fs.readFileSync(`D:/2026/_scratch-ybh/${f}`, 'utf8').split('\n').slice(1).filter(Boolean).map((x) => x.split('\t'))) {
    if (r[6]) quoteOf.set(`${r[0]}#${r[1]}`, r[6]!);
  }
}
const rows = fs.readFileSync('D:/2026/_scratch-ybh/spans-j.tsv', 'utf8').split('\n').slice(1).filter(Boolean).map((r) => r.split('\t'));
const withJ = rows.filter((r) => r[4] && r[5]);
const step = Math.max(1, Math.floor(withJ.length / 24));
let hit = 0, miss = 0; const bad: string[] = [];
for (let i = 0; i < withJ.length; i += step) {
  const r = withJ[i]!;
  const res = await renderEmbed('taisho', r[3]!, '', `${r[4]}-${r[5]}`, '', false, rd);
  const quote = (quoteOf.get(`${r[1]}#${r[2]}`) ?? '').replace(/[^一-鿿]/g, '').slice(0, 6);
  if (quote) {
    const txt = res.html.replace(/<[^>]*>/g, '').replace(/[^一-鿿]/g, '');
    if (txt.includes(quote.slice(0, 4))) hit++;
    else { miss++; if (bad.length < 4) bad.push(`${r[1]}#${r[2]}「${quote}」∉ ${txt.slice(0, 40)}`); }
  }
}
console.log(`抽樣 ${hit + miss}：j 對位命中 ${hit}、不符 ${miss}`);
if (bad.length) console.log(bad.join('\n'));
