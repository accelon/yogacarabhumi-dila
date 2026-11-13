#!/usr/bin/env bun
/**
 * P0 試點 v3：連寫短語(緊)階梯 10→7→5 ＋ 標點邻近回退 ＋ T1579 書範圍 ＋ 單調消歧。
 * 修正 v1/v2 假陰性：opening() 曾刪標點製造跨標點假陰性(13 條)、又把腳註行當起句(2 條)。
 * 全程只用引擎檢索 taisho.adb，不抽全文。
 * (3) 多命中用「前一頁欄單調」消歧。仍然只用引擎檢索，不抽全文。
 */
import fs from 'node:fs';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const md = fs.readFileSync('D:/2026/yogacarabhumi-dila/T1579-1.md', 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
// 起句：只剝「CBETA 沒有的 DILA 添加物」——書目連結行、註碼〔^n〕、括注拉丁（梵roma）。
// **保留漢字與標點**（？。；，、）——先前刪標點會把「云何夢？謂由」壓成連寫串，
// 引擎「連寫＝短語」要求字字相鄰，卡在問號 token 上匹配不到（2026-11-13 修正：那是假陰性）。
function opening(text: string): string {
  let t = text
    .replace(/《\[\[[^\]]*\]\]》/g, '')   // DILA 互鏈書目行
    .replace(/\[\^[^\]]+\]/g, '')          // 腳註代碼
    .replace(/（[^）]*[A-Za-zā-ūṃ][^）]*）/g, '') // 括注梵羅（DILA 加，CBETA 無）
    .replace(/[^一-鿿？。，、；：！？]/g, ''); // 留漢字＋全形標點
  return t;
}
// 標點切成連寫漢字片段（引擎索引無單個標點 token，標點只當分隔符、不進查詢）
function frags(phrase: string, K: number): string[] {
  let cjk = 0, raw = '';
  for (const ch of phrase) { raw += ch; if (/[一-鿿]/.test(ch)) cjk++; if (cjk >= K) break; }
  return raw.split(/[？。，、；：！]/).map((x) => x.replace(/[^一-鿿]/g, '')).filter((x) => x.length >= 2);
}
type Item = { kp: string; heading: string; full: string };
const items: Item[] = [];
let pending: { kp: string; heading: string } | null = null;
for (const ln of md) {
  const h = /^#{1,6}\s+(.*?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln);
  if (h) { pending = { kp: h[2], heading: h[1].replace(/^[A-Z]\d*\s*/, '') }; continue; }
  if (!pending) continue;
  const t = ln.trim();
  if (!t || /^《/.test(t) || /^\[\^/.test(t)) continue; // 空行／書目參考行／腳註定義行（非論本原文）
  const ph = opening(t);
  if (ph.length >= 4) items.push({ ...pending, full: ph });
  pending = null;
}

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd);
await s.init();
const tags = rd.containers.get('tags')!;
const pi = tags.names.indexOf('頁');
const pageVas = await rd.decodeBlockList('tags', pi);
const av = await rd.attributeValues('頁.id');
const ids: string[] = (av?.values ?? []).map(String);
function pageOf(va: number): string {
  let lo = 0, hi = pageVas.length - 1, at = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (pageVas[m]! <= va) { at = m; lo = m + 1; } else hi = m - 1; }
  return at < 0 ? '' : ids[at] ?? '';
}
// T1579 書範圍（ cachedStrings('書') 找瑜伽師地論，下一書為界）
const si = tags.names.indexOf('書');
let lo30 = -1, hi30 = Infinity;
if (si >= 0) {
  const sVas = await rd.decodeBlockList('tags', si);
  const sNames = await rd.cachedStrings('書');
  const at = sNames.findIndex((n) => n.includes('瑜伽師地論'));
  if (at >= 0) { lo30 = sVas[at]!; hi30 = at + 1 < sVas.length ? sVas[at + 1]! : Infinity; }
}
console.log('T1579 VA 範圍', lo30, '→', hi30 === Infinity ? 'EOF' : hi30);

const pgNum = (p: string) => +(/30p(\d+)/.exec(p)?.[1] ?? NaN);
const colRank = (p: string) => 'abc'.indexOf(p.slice(-1)) + (/30p\d+[abc](\d*)/.exec(p)?.[1] ? +/30p\d+[abc](\d*)/.exec(p)![1]! / 1000 : 0);
const rank = (p: string) => pgNum(p) * 10 + colRank(p);

let prevRank = 0, prevPage = '30p279a';
let direct = 0, shortened = 0, disamb = 0, miss = 0, offbook = 0;
const regressList: string[] = [];
const rows: string[] = [];
// 取前 K 個「漢字」為窗口（保留其間的標點）
function headN(phrase: string, K: number): string {
  let cjk = 0, out = '';
  for (const ch of phrase) { out += ch; if (/[一-鿿]/.test(ch)) cjk++; if (cjk >= K) break; }
  return out;
}
// 兩級定位：① 連寫短語（緊、跨不出標點界）階梯 10→7→5；② 若全落空，用切片段邻近回退
// （末片段當錨、前一片段須落在其前 ~60 字內，避開文件級 AND 的過鬆）。回傳 {va,tight}。
async function locate(phrase: string): Promise<{ va: number; tight: boolean }[]> {
  for (const K of [10, 7, 5]) {
    const contig = frags(phrase, K).join(''); // 無標點連寫
    if (contig.length >= 4) {
      const res = await s.search(contig, 500);
      const vas = [...new Set(res.hits.map((h: { va: number }) => h.va))].filter((v) => v >= lo30 && v < hi30);
      if (vas.length) return vas.map((va) => ({ va, tight: true }));
    }
  }
  const F = frags(phrase, 12);
  if (F.length >= 2) {
    const anchor = F[F.length - 1]!;
    const prev = F[F.length - 2]!;
    const ar = await s.search(anchor, 500);
    const pr = await s.search(prev, 500);
    const pvas = pr.hits.map((x: { va: number }) => x.va);
    const outs: { va: number; tight: boolean }[] = [];
    for (const h of ar.hits) {
      if (h.va < lo30 || h.va >= hi30) continue;
      if (pvas.some((v: number) => v <= h.va && v >= h.va - 60)) outs.push({ va: h.va, tight: false });
    }
    if (outs.length) return outs.sort((a, b) => a.va - b.va);
  }
  return [];
}
for (const it of items) {
  const hits = await locate(it.full);
  const hitsVa = [...new Set(hits.map((x) => x.va))].sort((a, b) => a - b);
  const tight = hits[0]?.tight ?? false;
  if (!hitsVa.length) {
    miss++; rows.push(`MISS\t${it.kp}\t${frags(it.full, 12).join('')}`); continue;
  }
  const pages = hitsVa.map(pageOf);
  if (hitsVa.length === 1) { direct++; if (!tight) shortened++; }
  else { disamb++; }
  // 多命中：取「≥ 前一頁欄」中最小者（單調假設）
  let at = pages.findIndex((p) => rank(p) >= prevRank - 3); // 容忍同欄內小倒退
  if (at < 0) at = 0;
  const pick = pages[at]!;
  if (rank(pick) < prevRank - 3) regressList.push(`${it.kp} ${pick}<${prevPage}`);
  prevRank = Math.max(prevRank, rank(pick)); prevPage = pick;
  rows.push(`${hitsVa.length}\t${tight ? 'T' : 'N'}\t${it.kp}\t${pick}`);
  if (at > 0 && pages[0] !== pick) offbook++;
}
console.log(`總 ${items.length}：直接(10字唯一) ${direct - shortened}、縮短才中 ${shortened}、多命中需消歧 ${disamb}、miss ${miss}（${(100 * miss / items.length).toFixed(1)}%）`);
console.log(`消歧挑了非首hit ${offbook} 筆；單調倒退 ${regressList.length} 筆：`, regressList.slice(0, 8).join(' | '));
fs.writeFileSync('D:/2026/_scratch-ybh/span-pilot2.tsv', rows.join('\n'));
console.log('明細 → span-pilot2.tsv');
