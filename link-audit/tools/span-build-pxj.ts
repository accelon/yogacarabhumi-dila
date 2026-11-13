#!/usr/bin/env bun
/**
 * P1b span：披尋記科判 → CBETA T1579 頁欄。
 * 起句＝標題→（跳書目行/空行）→（跳全干支鏈行）→ 第一行引文。
 * 檢索只用引擎（連寫階梯＋標點邻近＋書範圍＋卷序單調消歧），miss 走跨卷插值。
 */
import fs from 'node:fs';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const ROOT = 'D:/2026/yogacarabhumi-dila';
const files = fs.readdirSync(ROOT).filter((f) => /^PXJ-H-\d+\.md$/.test(f)).sort((a, b) => +(/-(\d+)\.md/.exec(a)![1]!) - +(/-(\d+)\.md/.exec(b)![1]!));

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd);
await s.init();
const tags = rd.containers.get('tags')!;
const pageVas = await rd.decodeBlockList('tags', tags.names.indexOf('頁'));
const ids: string[] = ((await rd.attributeValues('頁.id'))?.values ?? []).map(String);
const sVas = await rd.decodeBlockList('tags', tags.names.indexOf('書'));
const sNames = await rd.cachedStrings('書');
const at = sNames.findIndex((n) => n.includes('瑜伽師地論'));
const lo30 = sVas[at]!, hi30 = at + 1 < sVas.length ? sVas[at + 1]! : Infinity;
function pageOf(va: number): string {
  let lo = 0, hi = pageVas.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (pageVas[m]! <= va) { r = m; lo = m + 1; } else hi = m - 1; }
  return r < 0 ? '' : ids[r] ?? '';
}
const rank = (p: string) => +(/30p(\d+)/.exec(p)?.[1] ?? NaN) * 10 + 'abc'.indexOf(p.slice(-1));
const GANZHI = /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥][一二三四五六七八九十]{1,3}、/;
function isChainLine(t: string): boolean {
  const segs = t.split('　').map((x) => x.trim()).filter(Boolean);
  return segs.length > 0 && segs.every((x) => GANZHI.test(x));
}
function frags(phrase: string, K: number): string[] {
  let cjk = 0, raw = '';
  for (const ch of phrase) { raw += ch; if (/[一-鿿]/.test(ch)) cjk++; if (cjk >= K) break; }
  return raw.split(/[？。，、；：！]/).map((x) => x.replace(/[^一-鿿]/g, '')).filter((x) => x.length >= 2);
}
async function locate(phrase: string): Promise<{ va: number; tight: boolean }[]> {
  for (const K of [10, 7, 5]) {
    const contig = frags(phrase, K).join('');
    if (contig.length >= 4) {
      const res = await s.search(contig, 500);
      const vas = [...new Set(res.hits.map((h: { va: number }) => h.va))].filter((v) => v >= lo30 && v < hi30);
      if (vas.length) return vas.map((va) => ({ va, tight: true }));
    }
  }
  const F = frags(phrase, 12);
  if (F.length >= 2) {
    const ar = await s.search(F[F.length - 1]!, 500);
    const pr = await s.search(F[F.length - 2]!, 500);
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

const rows: string[] = ['base\tkp\tpage\tmode\thits\tva\tquote'];
let okU = 0, okM = 0, miss = 0, interp = 0, tot = 0, noQuote = 0;
const t0 = Date.now();
let prevRank = 0;   // 披尋記卷序即論本卷序，跨卷單調成立
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const lines = fs.readFileSync(`${ROOT}/${f}`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  let pending: string | null = null;
  const volRows: string[][] = [];
  for (const ln of lines) {
    const hd = /^#{1,6}\s+(.*?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln);
    if (hd) { pending = hd[2]!; continue; }
    if (!pending) continue;
    const t = ln.trim();
    if (!t || /^《/.test(t) || /^\[\^/.test(t)) continue;
    if (isChainLine(t)) continue;               // 鏈行＝科文標籤，不是引文
    const kp = pending; pending = null; tot++;
    const phrase = t.replace(/《\[\[[^\]]*\]\]》/g, '').replace(/\[\^[^\]]+\]/g, '')
      .replace(/（[^）]*[A-Za-zā-ūṃ][^）]*）/g, '').replace(/「|」|『|』/g, '')
      .replace(/[^一-鿿？。，、；：！]/g, '');
    if (phrase.replace(/[？。，、；：！]/g, '').length < 4) { volRows.push([base, kp, '', 'noquote', '0', '', '']); noQuote++; continue; }
    const hits = await locate(phrase);
    if (!hits.length) { volRows.push([base, kp, '', 'miss', '0', '', phrase.slice(0, 16)]); continue; }
    const pages = hits.map((h) => pageOf(h.va));
    let i = pages.findIndex((p) => rank(p) >= prevRank - 3);
    if (i < 0) i = 0;
    prevRank = Math.max(prevRank, rank(pages[i]!));
    if (hits.length === 1) okU++; else okM++;
    volRows.push([base, kp, pages[i]!, hits[0]!.tight ? 'T' : 'N', String(hits.length), String(hits[i]!.va), phrase.slice(0, 16)]);
  }
  let last = '';
  for (const r of volRows) { if (r[2]) last = r[2]; else if (last && r[3] === 'miss') { r[2] = last; r[3] = 'I'; } }
  for (const r of volRows) { if (r[3] === 'I') interp++; else if (r[3] === 'miss') miss++; rows.push(r.join('\t')); }
  process.stdout.write(`.${base} `);
}
console.log(`\n披尋記 ${tot} 科判：唯一 ${okU}、消歧 ${okM}、插值 ${interp}、無引文 ${noQuote}、miss ${miss}｜${((Date.now() - t0) / 1000).toFixed(0)}s`);
fs.writeFileSync('D:/2026/_scratch-ybh/spans-pxj.tsv', rows.join('\n'), 'utf8');
console.log('→ spans-pxj.tsv');
