#!/usr/bin/env bun
/**
 * v21 精修：把段落 ref 的 **K 層（祖先繼承粗窗）** 換成段內逐字牒文窗。
 *
 * 動機（v20 實測）：入庫 5,604 條裡 K 佔 1,732（31%）。K 的窗是「所在科判往上找到的第一個窗」，
 * 常是一整地的開頭（如整段論釋 敘所為 都錨在「云何瑜伽師地」6 字），讀者點開看到的未必是該段所釋。
 *
 * 規則：對每條 K 行取其段落本文做滑窗（偏移 0–24、連續 24/18/14/10/8 漢字、引擎標點無感），
 * 命中後 greedy 延伸到最長一致片段；收的條件＝**全書唯一**（T1579 書區內僅 1 處）或
 * **與粗窗同頁帶**（|頁序差| ≤ 20 欄）。收後一律過 `renderEmbed`：窗本體取 `<mark class="xrefHit">`、
 * 漢字口徑取產品 `hanChars`，須「mark 漢字數 === je-js 且窗首相符」才算數，否則保留原粗窗並記錄。
 * 換成功的 mode 記 **Q2**（有別於 span-zhu 的 Q）。單調前推限在同一卷檔內，跨卷不互鎖。
 *
 * 產物：原地改寫 zhu-refs-*.tsv（該檔首見時先備份 *.pre-refine.tsv）；逐條前後對照累加寫入
 *   zhu-refine-k-audit.csv。任何一條沒過驗證都不動原值。
 * 用法：bun span-refine-k.ts [--dry] [--limit=N] [--only=T1828,PXJ-H]
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
const { SearchSession } = await import('D:/2026/adb-converter/ts/src/accelon26/search.ts');
const { pageHanTextOf } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const { hanChars } = await import('D:/2026/adb-converter/ts/src/accelon26/han.ts');

const V = 'D:/2026/yogacarabhumi-dila', SCR = 'D:/2026/_scratch-ybh';
const DRY = process.argv.includes('--dry');
const argOf = (k: string): string | undefined => process.argv.find((x) => x.startsWith(k + '='))?.split('=')[1];
const LIMIT = +(argOf('--limit') ?? '0');
const ONLY = argOf('--only')?.split(',') ?? null;
const AUDIT = argOf('--audit') ?? (SCR + '/zhu-refine-k' + (DRY ? '-dry' : '') + '-audit.csv');   // 並行分批時各給一個檔名，避免互相覆寫
const NL = String.fromCharCode(10);
fs.writeFileSync(AUDIT, '' + ['卷檔', '段起行', '所在科判', '舊粗窗', '新逐字窗', '牒文', '段落前24字', '判定'].join('\t') + NL, 'utf8');

const han = (x: string) => hanChars(x.replace(/<[^>]*>/g, '')).join('');
const clean = (x: string) => han(x.replace(/\[\[[^\]]*\]\]/g, '').replace(/\^[A-Za-z0-9_-]+/g, '').replace(/\[[^\]]*\]/g, ''));
const rank = (p: string) => +(/30p(\d+)/.exec(p)?.[1] ?? NaN) * 10 + 'abc'.indexOf(p.slice(-1));

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd); await s.init();
const tags = rd.containers.get('tags')!;
const pageVas = await rd.decodeBlockList('tags', tags.names.indexOf('頁'));
const ids: string[] = ((await rd.attributeValues('頁.id'))?.values ?? []).map(String);
const sVas = await rd.decodeBlockList('tags', tags.names.indexOf('書'));
const sNames = await rd.cachedStrings('書');
const at0 = sNames.findIndex((n) => n.includes('瑜伽師地論'));
const lo30 = sVas[at0]!, hi30 = sVas[at0 + 1]!;
function pageOf(va: number): string {
  let a = 0, b = pageVas.length - 1, r = -1;
  while (a <= b) { const m = (a + b) >> 1; if (pageVas[m]! <= va) { r = m; a = m + 1; } else b = m - 1; }
  return r < 0 ? '' : ids[r] ?? '';
}
async function hitsIn(contig: string): Promise<number[]> {
  if (contig.length < 8) return [];
  const res = await s.search(contig, 500);
  return [...new Set(res.hits.map((h: { va: number }) => h.va as number))].filter((v) => v >= lo30 && v < hi30).sort((x, y) => x - y);
}
const pageCache = new Map<string, string>();
async function phOf(p: string): Promise<string> {
  let v = pageCache.get(p);
  if (v === undefined) { v = await pageHanTextOf(rd, p); pageCache.set(p, v); }
  return v;
}
const mdCache = new Map<string, string[]>();
function mdOf(base: string): string[] {
  let v = mdCache.get(base);
  if (v === undefined) {
    v = fs.existsSync(V + '/' + base + '.md') ? fs.readFileSync(V + '/' + base + '.md', 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, NL).split(NL) : [];
    if (mdCache.size > 30) mdCache.clear();                 // 卷檔正文不小，累積 30 個後放掉舊的
    mdCache.set(base, v);
  }
  return v;
}

type Row = { cells: string[]; base: string; line: number; page: string; js: number; je: number; quote: string };
const files = fs.readdirSync(SCR).filter((x) => /^zhu-refs-.+\.tsv$/.test(x)).sort();
let nK = 0, nRefined = 0, nKept = 0;
const t0 = Date.now();
for (const f of files) {
  if (ONLY && !ONLY.some((o) => f.includes(o))) continue;
  const lines = fs.readFileSync(SCR + '/' + f, 'utf8').split(NL);
  const lineIdx = new Map<string, number>();
  lines.forEach((l, i) => { if (i > 0 && l.trim()) { const c = l.split('\t'); lineIdx.set(c[0] + '\t' + c[1], i); } });
  const rows: Row[] = [];
  lines.forEach((l, i) => {
    if (i === 0 || !l.trim()) return;
    const c = l.split('\t');
    if (c.length < 8 || c[6] !== 'K') return;
    rows.push({ cells: c, base: c[0]!, line: +c[1]!, page: c[3]!, js: +c[4]!, je: +c[5]!, quote: c[7] ?? '' });
  });
  if (!rows.length) continue;
  const work = LIMIT > 0 ? rows.slice(0, Math.max(0, LIMIT - nK)) : rows;
  if (!work.length) continue;
  work.sort((a, b) => (a.base < b.base ? -1 : a.base > b.base ? 1 : a.line - b.line));
  nK += work.length;
  const audit: string[] = [];
  let lastVa = lo30, curBase = '';
  for (const r of work) {
    if (r.base !== curBase) { curBase = r.base; lastVa = lo30; }
    const txt = clean(mdOf(r.base)[r.line - 1] ?? '');
    if (txt.length < 8) continue;
    let found: { va: number; len: number; start: number; page: string; uniq: boolean } | null = null;
    outer: for (let st = 0; st + 8 <= txt.length && st <= 24; st++) {
      for (const K of [24, 18, 14, 10, 8]) {
        const cand = txt.slice(st, st + K);
        if (cand.length < 8) continue;
        const vas = await hitsIn(cand);
        if (!vas.length) continue;
        const pick = vas.find((v) => v >= lastVa) ?? vas[0]!;        // 不回頭優先，全在前面才放寬
        const pg = pageOf(pick);
        const uniq = vas.length === 1;
        if (!uniq && Math.abs(rank(pg) - rank(r.page)) > 20) continue;
        let L = K;
        for (const step of [16, 8, 4, 2, 1]) {
          for (;;) {
            const nx = txt.slice(st, st + L + step);
            if (nx.length < L + step || L + step > 48) break;
            if ((await hitsIn(nx)).includes(pick)) { L += step; continue; }
            break;
          }
        }
        found = { va: pick, len: L, start: st, page: pg, uniq };
        break outer;
      }
    }
    if (!found) continue;
    const b = found, q = txt.slice(b.start, b.start + b.len), oldKey = r.page + '#' + r.js + '-' + r.je;
    const head = [r.base, r.line, r.quote.split('→')[0], oldKey];
    const ph = await phOf(b.page);
    const js = ph.indexOf(q);
    if (js < 0) { nKept++; audit.push([...head, b.page, q, txt.slice(0, 24), '頁內定位失敗→保留粗窗'].join('\t')); continue; }
    const je = Math.min(js + b.len, ph.length);
    if (b.page === r.page && js === r.js && je === r.je) { lastVa = b.va; continue; }          // 本就同窗
    const res = await renderEmbed('taisho', b.page, '', js + '-' + je, '', false, rd as any);
    const mark = han(/<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '');
    if (mark.length !== je - js || !mark.startsWith(q.slice(0, Math.min(6, q.length)))) {
      nKept++;
      audit.push([...head, b.page + '#' + js + '-' + je, q, txt.slice(0, 24), 'renderEmbed 未過（mark ' + mark.length + ' vs ' + (je - js) + '）→保留粗窗'].join('\t'));
      continue;
    }
    lastVa = b.va;
    r.cells[3] = b.page; r.cells[4] = String(js); r.cells[5] = String(je); r.cells[6] = 'Q2'; r.cells[7] = q;
    const idx = lineIdx.get(r.base + '\t' + r.line);
    if (idx !== undefined && idx > 0) lines[idx] = r.cells.join('\t');
    nRefined++;
    audit.push([...head, b.page + '#' + js + '-' + je, q, txt.slice(0, 24), b.uniq ? '換窗（全書唯一）' : '換窗（同頁帶）'].join('\t'));
  }
  fs.appendFileSync(AUDIT, audit.length ? audit.join(NL) + NL : '', 'utf8');
  console.log('  ' + f + '：K ' + work.length + ' 條｜累計換窗 ' + nRefined + '、保留 ' + nKept + '｜' + ((Date.now() - t0) / 1000).toFixed(0) + 's');
  if (!DRY && nRefined) {
    const bak = SCR + '/' + f.replace(/\.tsv$/, '.pre-refine.tsv');
    if (!fs.existsSync(bak)) fs.writeFileSync(bak, fs.readFileSync(SCR + '/' + f), 'utf8');
    fs.writeFileSync(SCR + '/' + f, lines.join(NL), 'utf8');
  }
}
console.log('K 粗窗 ' + nK + ' 條 → 換成逐字窗 ' + nRefined + '（' + (100 * nRefined / Math.max(1, nK)).toFixed(1) + '%）、未過驗證保留粗窗 ' + nKept + '｜' + ((Date.now() - t0) / 1000).toFixed(0) + 's' + (DRY ? '｜DRAFT 未寫回' : ''));
console.log('→ ' + AUDIT);
