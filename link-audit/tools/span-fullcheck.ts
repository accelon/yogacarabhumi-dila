#!/usr/bin/env bun
/**
 * v14 全數驗證：spans-j.tsv 每條有 j 窗的行 —
 *   ① anchorVa('頁欄#a-b') 非 null
 *   ② pageHanTextOf(頁) 的 [a,b) 窗開頭 ＝ 預期引文前 4 字（產品口徑，逐頁快取）
 * 引文來源＝spans-t1579/spans-pxj 的 quote 欄。
 */
import fs from 'node:fs';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { anchorVa, pageHanTextOf } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const quoteOf = new Map<string, string>();
for (const f of ['spans-t1579.tsv', 'spans-pxj.tsv']) {
  for (const c of fs.readFileSync(`D:/2026/_scratch-ybh/${f}`, 'utf8').split('\n').slice(1).filter(Boolean).map((x) => x.split('\t'))) {
    if (c[6]) quoteOf.set(`${c[0]}#${c[1]}`, c[6]!);
  }
}
const rows = fs.readFileSync('D:/2026/_scratch-ybh/spans-j.tsv', 'utf8').split('\n').slice(1).filter(Boolean).map((x) => x.split('\t'));
const withJ = rows.filter((r) => r[4] && r[5]);
console.log('待驗行數（有 j 窗）:', withJ.length);

const pageCache = new Map<string, string>();
let pass = 0; const fails: string[] = [];
let unresolved = 0, badWindow = 0, badStart = 0, noQuote = 0;
const t0 = Date.now();
for (const r of withJ) {
  const [, base, kp, page, js, je] = r;
  const link = `${page}#${js}-${je}`;
  const va = await anchorVa(rd, link);
  if (va == null) { unresolved++; if (fails.length < 12) fails.push(`解析失敗 ${base}#${kp} ${link}`); continue; }
  let han = pageCache.get(page!);
  if (han === undefined) { han = await pageHanTextOf(rd, page!); pageCache.set(page!, han); }
  const a = +js!, b = +je!;
  if (!(a >= 0 && b > a && b <= han.length + 8)) { badWindow++; if (fails.length < 12) fails.push(`窗越界 ${base}#${kp} ${a}-${b} len=${han.length}`); continue; }
  const q = (quoteOf.get(`${base}#${kp}`) ?? '').replace(/[^一-鿿]/g, '');
  if (q.length < 2) { noQuote++; pass++; continue; }
  const win = han.slice(a, b).replace(/[^一-鿿]/g, '');
  const key = q.slice(0, 4);
  if (win.startsWith(key)) pass++;
  else { badStart++; if (fails.length < 12) fails.push(`窗首不符 ${base}#${kp} 期望「${key}」得「${win.slice(0, 6)}」`); }
}
console.log(`結果: ${pass}/${withJ.length} 通過（${(100 * pass / withJ.length).toFixed(2)}%）｜解析失敗 ${unresolved}｜窗越界 ${badWindow}｜窗首不符 ${badStart}｜無引文可比 ${noQuote}｜${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (fails.length) console.log('樣本:\n' + fails.join('\n'));
