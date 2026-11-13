#!/usr/bin/env bun
/**
 * P1 span 流水線全卷版：T1579-1..100.md 每個 kpD 科判 → CBETA taisho.adb 頁欄。
 * 方法＝v3 試點（連寫階梯 10→7→5 ＋標點邻近回退 ＋書範圍過濾 ＋卷內單調消歧），
 * 全程只用引擎檢索，不抽全文。輸出 spans-t1579.tsv。
 */
import fs from 'node:fs';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { SearchSession } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const ROOT = 'D:/2026/yogacarabhumi-dila';
const files = fs.readdirSync(ROOT).filter((f) => /^T1579-\d+\.md$/.test(f)).sort((a, b) => +(/-(\d+)\.md/.exec(a)![1]!) - +(/-(\d+)\.md/.exec(b)![1]!));

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd);
await s.init();
const tags = rd.containers.get('tags')!;
const pi = tags.names.indexOf('頁');
const pageVas = await rd.decodeBlockList('tags', pi);
const av = await rd.attributeValues('頁.id');
const ids: string[] = (av?.values ?? []).map(String);
const si = tags.names.indexOf('書');
let lo30 = -1, hi30 = Infinity;
if (si >= 0) {
  const sVas = await rd.decodeBlockList('tags', si);
  const sNames = await rd.cachedStrings('書');
  const at = sNames.findIndex((n) => n.includes('瑜伽師地論'));
  if (at >= 0) { lo30 = sVas[at]!; hi30 = at + 1 < sVas.length ? sVas[at + 1]! : Infinity; }
}
function pageOf(va: number): string {
  let lo = 0, hi = pageVas.length - 1, at = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (pageVas[m]! <= va) { at = m; lo = m + 1; } else hi = m - 1; }
  return at < 0 ? '' : ids[at] ?? '';
}
const pgNum = (p: string) => +(/30p(\d+)/.exec(p)?.[1] ?? NaN);
const colRank = (p: string) => 'abc'.indexOf(p.slice(-1));
const rank = (p: string) => pgNum(p) * 10 + colRank(p);

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

const rows: string[] = ['base\tkp\tpage\tmode\thits'];
let okU = 0, okM = 0, miss = 0, interp = 0, tot = 0;
const t0 = Date.now();
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const lines = fs.readFileSync(`${ROOT}/${f}`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  const volRows: string[][] = [];
  let prevRank = 0;
  let pending: { kp: string } | null = null;
  for (const ln of lines) {
    const hd = /^#{1,6}\s+(.*?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln);
    if (hd) { pending = { kp: hd[2]! }; continue; }
    if (!pending) continue;
    const t = ln.trim();
    if (!t || /^《/.test(t) || /^\[\^/.test(t)) continue;
    const kp = pending.kp; pending = null; tot++;
    // 保留標點送 locate()（v3 教訓）；表格行先拆格、取最長合格片段當起句（攝抉擇分多為問答表）
    let phrase = '';
    if (/^\|/.test(t)) {
      const cells = t.split('|').map((x) => x.trim().replace(/^>+/, '').trim()).filter((x) => x.length >= 4 && !/^[問答]：/.test(x) && !/^\d+$/.test(x));
      cells.sort((a, b) => b.length - a.length);
      phrase = (cells[0] || '').replace(/（[^）]*[A-Za-zā-ūṃ][^）]*）/g, '').replace(/[^一-鿿？。，、；：！]/g, '');
    } else {
      phrase = t
        .replace(/《\[\[[^\]]*\]\]》/g, '')
        .replace(/\[\^[^\]]+\]/g, '')
        .replace(/（[^）]*[A-Za-zā-ūṃ][^）]*）/g, '')
        .replace(/[^一-鿿？。，、；：！]/g, '');
    }
    if (!phrase) { volRows.push([base, kp, '', 'miss', '0']); continue; }
    const hits = await locate(phrase);
    if (!hits.length) { volRows.push([base, kp, '', 'miss', '0']); continue; }
    const pages = hits.map((h) => pageOf(h.va));
    let at = pages.findIndex((p) => rank(p) >= prevRank - 3);
    if (at < 0) at = 0;
    const pick = pages[at]!;
    prevRank = Math.max(prevRank, rank(pick));
    if (hits.length === 1) okU++; else okM++;
    volRows.push([base, kp, pick, hits[0]!.tight ? 'T' : 'N', String(hits.length)]);
  }
  // 卷內插值兜底：miss 承最近已解頁欄（單調性保證方向正確），標 I
  let last = '';
  for (const r of volRows) {
    if (r[2]) { last = r[2]; continue; }
    if (last) { r[2] = last; r[3] = 'I'; }
  }
  for (let i = 0; i < volRows.length; i++) {   // 卷首 miss 向後回填
    if (volRows[i]![2]) {
      for (let j = i - 1; j >= 0 && !volRows[j]![2]; j--) { volRows[j]![2] = volRows[i]![2]; volRows[j]![3] = 'I'; }
      break;
    }
  }
  for (const r of volRows) { if (r[3] === 'I') interp++; else if (r[3] === 'miss') miss++; rows.push(r.join('\t')); }
  process.stdout.write(`.${base} `);
}
console.log(`\nT1579 全卷 ${tot}：唯一 ${okU}、需消歧 ${okM}、miss ${miss}（${(100 * miss / tot).toFixed(1)}%）｜${((Date.now() - t0) / 1000).toFixed(0)}s`);
fs.writeFileSync('D:/2026/_scratch-ybh/spans-t1579.tsv', rows.join('\n'), 'utf8');
console.log('→ _scratch-ybh/spans-t1579.tsv');
