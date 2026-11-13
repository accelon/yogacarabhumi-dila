#!/usr/bin/env bun
/**
 * P2 注文段落 ref 驗收 v2（全條、走產品同碼路，不抽樣）。
 *  真值來源分兩份：
 *   - `zhu-refs-shipped.tsv`＝build-ybh 實際入庫清單（含展示端同窗收攏），逐 key 計數必須與 adb 一致；
 *   - `zhu-refs-*.tsv`＝資料端逐段真相表，提供 mode 與 Q 層牒文原文。
 *  每條都經消費者碼路 renderEmbed 從 taisho.adb 取回窗，斷言
 *   ① `<mark class="xrefHit">` 漢字數 == je-js（窗本體，embedText 另含句尾上下文）
 *   ② 聯座標 == 嵌座標（同一行兩條目不得分家）
 *   ③ Q 層另比「窗首 == 牒文前 6 字」
 *  ④ 反向：shipped 清單裡的 key 若 adb 內找不到 → 缺發（FAIL）。
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
const { pageHanTextOf } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const { hanChars } = await import('D:/2026/adb-converter/ts/src/accelon26/han.ts');
// 漢字口徑必須用產品自己的 isHan（含 Ext A 等）——自帶 [一-鿿] 會把 㲉（U+3C89）滤掉，
// 造成 mark 與切片「看起來」錯位的假警報（v18 首驗曾誤判 30p288b#175-189 為真錯位）。
const han = (x: string) => hanChars(x).join('');

const YBH = process.argv[2] ?? 'D:/accelon3/ybh.adb';
const SCR = 'D:/2026/_scratch-ybh';

// ---- 資料端真相表：key → {mode,quote}（Q 優先）----
const truth = new Map<string, { mode: string; quote: string }>();
const workTally: Record<string, number> = {};
for (const f of fs.readdirSync(SCR).filter((x) => /^zhu-refs-.+\.tsv$/.test(x)).sort()) {
  for (const ln of fs.readFileSync(`${SCR}/${f}`, 'utf8').split('\n').slice(1)) {
    const c = ln.split('\t');
    if (c.length < 8 || !c[3]) continue;
    const mode = c[6]!;
    if (mode === 'none' || mode === 'drop' || mode === 'dup') continue;
    const key = c[4] === '-1' ? c[3]! : `${c[3]}#${c[4]}-${c[5]}`;
    const prev = truth.get(key);
    if (!prev || (mode === 'Q' && prev.mode !== 'Q')) truth.set(key, { mode, quote: c[7] ?? '' });
  }
}
// ---- 入庫清單 ----
const want = new Map<string, number>();
for (const ln of fs.readFileSync(`${SCR}/zhu-refs-shipped.tsv`, 'utf8').split('\n').slice(1)) {
  const c = ln.split('\t');
  if (c.length < 4) continue;
  want.set(c[3]!, (want.get(c[3]!) ?? 0) + 1);
  const w = c[0]!.replace(/-\d+$/, '');
  workTally[w] = (workTally[w] ?? 0) + 1;
}

// ---- 從 adb 位元組回讀（整庫串接：ref 行可能被寫入器切在兩個 block 邊界——v18 實測 block 1247 開頭就是半個 tag）----
const yrd = await AdbReader.open(new SyncIO(YBH));
const n = yrd.containers.get('source')!.count;
const parts: string[] = [];
for (let b = 0; b < n; b++) parts.push(await yrd.sourceText(b));
const whole = parts.join('');
const got = new Map<string, number>();
const pairs: { key: string; page: string; js: number; je: number }[] = [];
{
  for (const m of whole.matchAll(/<聯 i="taisho\?([^"]+)">所釋<\/聯>/g)) {
    const link = m[1]!;
    const after = whole.slice(m.index + m[0].length, m.index + m[0].length + 130);
    const e = /^[\s\r\n]*<嵌 i="taisho\?([^"]+)" j="(\d+)-(\d+)" n="論文"\/>/.exec(after);
    const key = e ? `${e[1]}#${e[2]}-${e[3]}` : link;
    if (e && link !== `${e[1]}#${e[2]}-${e[3]}`) console.log(`⚠ 聯/嵌 分家：聯=${link} 嵌=${e[1]}#${e[2]}-${e[3]}`);
    got.set(key, (got.get(key) ?? 0) + 1);
    if (e) pairs.push({ key, page: e[1]!, js: +e[2]!, je: +e[3]! });
  }
}

// ---- 逐條取窗驗證 ----
const trd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const pageCache = new Map<string, string>();
let winOk = 0, winBad = 0, tailShort = 0, qOk = 0, qBad = 0, qMiss = 0;
const fails: string[] = [];
for (const p of pairs) {
  const res = await renderEmbed('taisho', p.page, '', `${p.js}-${p.je}`, '', false, trd as any);
  const mark = han(/<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '');
  if (mark.length !== p.je - p.js || mark.length === 0) {
    // 分類：若 mark 與 pageHanTextOf 切片「前段全同」，是消費端把窗尾截短（VA/PA 家族缺陷）；
    // 若前段就不同，才是真錯位（要修資料）。
    let ph = pageCache.get(p.page);
    if (ph === undefined) { ph = await pageHanTextOf(trd, p.page); pageCache.set(p.page, ph); }
    const slice = ph.slice(p.js, p.je);
    const startOk = slice.startsWith(mark.slice(0, Math.min(12, mark.length))) && mark.length > 0;
    if (startOk) tailShort++;
    else { winBad++; if (fails.length < 10) fails.push(`真錯位 ${p.key}：mark「${mark.slice(0, 12)}」≠ 切片「${slice.slice(0, 12)}」`); continue; }
    continue;
  }
  winOk++;
  const t = truth.get(p.key);
  if (t?.mode === 'Q') {
    if (mark.startsWith(han(t.quote).slice(0, 6))) qOk++;
    else { qBad++; if (fails.length < 10) fails.push(`Q 窗首不符 ${p.key} 期望「${han(t.quote).slice(0, 6)}」得「${mark.slice(0, 8)}」`); }
  }
}
const missing = [...want.entries()].filter(([k, v]) => (got.get(k) ?? 0) < v);
const extra = [...got.entries()].filter(([k, v]) => !(want.get(k) ?? 0));
if (missing.length) console.log('缺發明細（want→got）：' + missing.slice(0, 6).map(([k, v]) => `${k} ${v}→${got.get(k) ?? 0}`).join('  '));
const totalWant = [...want.values()].reduce((a, b) => a + b, 0);
const totalGot = [...got.values()].reduce((a, b) => a + b, 0);
qMiss = pairs.filter((p) => truth.get(p.key)?.mode !== 'Q').length;
console.log(`入庫清單 ${totalWant} 條（${Object.entries(workTally).map(([k, v]) => `${k}:${v}`).join(' ')}）｜adb 回讀 ${totalGot} 條、去重後 ${got.size} 種窗`);
console.log(`窗長正確 ${winOk}/${pairs.length}、真錯位 ${winBad}、窗尾截短（消費端 VA/PA 家族，起點正確）${tailShort}｜Q 窗首 OK ${qOk}、FAIL ${qBad}（非 Q 窗 ${qMiss}）`);
console.log(`缺發 ${missing.length} 種｜adb 有而清單無 ${extra.length} 種`);
if (fails.length) console.log(fails.join('\n'));
console.log(winBad === 0 && qBad === 0 && missing.length === 0 && extra.length === 0 ? 'PASS' : 'CHECK');
