#!/usr/bin/env bun
/**
 * P2 注文段落 ref 驗收（走產品同碼路，非抽樣）。
 *  1) 從**已建好的 ybh.adb**（非記憶體陣列）讀出段落 ref 行，確認 XML 落地無損；
 *  2) 每條 j 窗用消費者碼路 renderEmbed 取回，比對「漢字數＝je-js」「窗首＝refs-t1580.tsv 的牒文首」；
 *     K 層（科判 span）者的窗本已在全庫 26,066 條逐條驗證中通過，此處只驗「association 落地＋窗可取回」。
 *  3) 順比對 refs-t1580.tsv 行數，確保發出的鏈條數＝資料條數（Q 2＋K 33＝35）。
 */
import fs from 'node:fs';
const el = () => ({
  style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '',
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {},
  addEventListener() {}, removeEventListener() {}, querySelector() { return null; },
  querySelectorAll() { return []; }, after() {}, insertBefore() {},
});
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' };
g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
g.CSS = { highlights: new Map() };
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');

const YBH = process.argv[2] ?? 'D:/2026/_scratch-ybh/ybh/ybh.adb';
const hanOnly = (x: string) => x.replace(/[^一-鿿]/g, '');

// ---- 資料端真值 ----
const expect = new Map<number, { page: string; js: number; je: number; mode: string; quote: string }>();
for (const r of fs.readFileSync('D:/2026/_scratch-ybh/refs-t1580.tsv', 'utf8').split('\n').slice(1)) {
  const c = r.split('\t');
  if (c.length < 6 || !c[2] || c[5] === 'none' || c[5] === 'drop') continue;
  expect.set(+c[0]!, { page: c[2]!, js: +c[3]!, je: +c[4]!, mode: c[5]!, quote: c[6] ?? '' });
}

// ---- 從 adb 讀出所釋行（逐 block 掃原始位元組解出的文字；count 才是區塊數）----
const yrd = await AdbReader.open(new SyncIO(YBH));
const n = yrd.containers.get('source')!.count;
const found: { link: string; page: string; js: number; je: number }[] = [];
for (let b = 0; b < n; b++) {
  const txt = await yrd.sourceText(b);
  if (!txt.includes('所釋</聯>')) continue;
  // adb 內行界不保證是 \n（區塊文字直接相連），故用「所釋</聯>」定位、向後視窗找相鄰的 <嵌>
  for (const m of txt.matchAll(/<聯 i="taisho\?([^"]+)">所釋<\/聯>/g)) {
    const after = txt.slice(m.index + m[0].length, m.index + m[0].length + 120);
    const e = /^[\s\r\n]*<嵌 i="taisho\?([^"]+)" j="(\d+)-(\d+)" n="論文"\/>/.exec(after);
    found.push({ link: m[1]!, page: e?.[1] ?? '', js: e ? +e[2]! : -1, je: e ? +e[3]! : -1 });
  }
}
const trd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
let total = 0, winOk = 0, winBad = 0, qMatch = 0, qBad = 0, noWin = 0;
const fails: string[] = [];
const shown: string[] = [];
for (const f of found) {
  total++;
  const { page, js, je } = f;
  if (js >= 0 && f.link !== `${page}#${js}-${je}`) { fails.push(`聯/嵌 座標不一致：聯=${f.link} 嵌=${page}#${js}-${je}`); winBad++; continue; }
  if (!page || js < 0) { noWin++; continue; }
  const res = await renderEmbed('taisho', page, '', `${js}-${je}`, '', false, trd as any);
  // 嵌卡回傳＝<mark class="xrefHit">目標窗</mark> ＋ 句尾上下文，故取 mark 才是窗本體
  const mark = hanOnly(/<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '');
  const e = [...expect.values()].find((x) => `${x.page}#${x.js}-${x.je}` === `${page}#${js}-${je}`);
  if (mark.length === je - js && mark.length > 0) winOk++;
  else { winBad++; if (fails.length < 8) fails.push(`窗長不符 ${page}#${js}-${je}：mark ${mark.length} 字「${mark.slice(0, 12)}」`); continue; }
  if (e && e.mode === 'Q') {
    if (mark.startsWith(hanOnly(e.quote).slice(0, 6))) qMatch++;
    else { qBad++; if (fails.length < 8) fails.push(`Q 窗首不符 ${page}#${js}-${je} 期望「${hanOnly(e.quote).slice(0, 6)}」得「${mark.slice(0, 8)}」`); }
  }
  if (shown.length < 40) shown.push(`${page}#${js}-${je} [${e?.mode ?? '?'}] ${mark}`);
}
const withWin = [...expect.values()].filter((x) => x.js >= 0).length;
console.log(`adb 內段落 ref ${total} 條｜資料端應發 ${expect.size}（有窗 ${withWin}）｜窗取回正確 ${winOk}、不符 ${winBad}｜無窗（僅聯）${noWin}｜Q 窗首比對 OK ${qMatch}、FAIL ${qBad}`);
console.log(shown.join('\n'));
if (fails.length) console.log(fails.join('\n'));
console.log(total === expect.size && winBad === 0 && qBad === 0 ? 'PASS' : 'CHECK');
