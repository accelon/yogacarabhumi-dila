#!/usr/bin/env bun
/**
 * P2 論釋（T1580）注文段落 ref —— 終版（四代演進彙整）。
 *
 * 【論釋引文規則】兩層，依實测定案：
 *  Q 層（逐字牒文）：論釋以義引為主，段起逐字只 24/86，且多落在《瑜伽師地論釋》自身
 *    （CBETA 30p883a，在 T1579 書區 [45128898,46091786) 之外）。改「滑窗牒文」：段內自第 0
 *    漢字起滑 ≤16 字、取連續 ≥8 漢字窗丢進 CBETA 檢索（引擎標點無感），命中後 greedy 延伸
 *    求最長一致片段。92 段得 7 條真逐字（其餘確屬自撰義引）。
 *  K 層（科判 span）：未逐字者，錨到**所在科判**的原文 span——科判對齊表由
 *    span-build-t1580.ts 產出（T1580 科判標題 ↔ T1579 DILA 科判標題 LCS＋缺口填補，
 *    窗全部取自 spans-j-verified.tsv 的 26,066 條已逐條 renderEmbed 驗證者）。
 *  取捨：Q 命中且與所在科判 span 同頁欄 ±2 欄內 → 用 Q（較精確）；差距大者棄 Q 用 K
 *    （防平行文句錯指，如三摩呬多地段落在 p504c 找到同字句）；科判無 span 而 Q 命中 → 用 Q；
 *    Q 窗未過 renderEmbed 者降為僅頁欄聯（Q-link），不发 j 窗。
 * 輸出 refs-t1580.tsv（line kp page js je mode quote）＋ Excel 可匯入的 refs-t1580-review.csv。
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

const VAULT = 'D:/2026/yogacarabhumi-dila', SCR = 'D:/2026/_scratch-ybh';
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd);
await s.init();
const tags = rd.containers.get('tags')!;
const pageVas = await rd.decodeBlockList('tags', tags.names.indexOf('頁'));
const ids: string[] = ((await rd.attributeValues('頁.id'))?.values ?? []).map(String);
const sVas = await rd.decodeBlockList('tags', tags.names.indexOf('書'));
const sNames = await rd.cachedStrings('書');
const at0 = sNames.findIndex((n) => n.includes('瑜伽師地論'));
const lo30 = sVas[at0]!, hi30 = sVas[at0 + 1]!;
function pageOf(va: number): string {
  let lo = 0, hi = pageVas.length - 1, r = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (pageVas[m]! <= va) { r = m; lo = m + 1; } else hi = m - 1; }
  return r < 0 ? '' : ids[r] ?? '';
}
const hanOnly = (x: string) => x.replace(/[^一-鿿]/g, '');
const rank = (p: string) => +(/30p(\d+)/.exec(p)?.[1] ?? NaN) * 10 + 'abc'.indexOf(p.slice(-1));
async function hitsInRange(contig: string): Promise<number[]> {
  const res = await s.search(contig, 500);
  return [...new Set(res.hits.map((h: { va: number }) => h.va as number))].filter((v) => v >= lo30 && v < hi30);
}
async function findHit(contig: string, floor: number): Promise<number | null> {
  if (contig.length < 8) return null;
  const vas = (await hitsInRange(contig)).filter((v) => v >= floor).sort((a, b) => a - b);
  return vas.length ? vas[0]! : null;
}

// ---- 科判 span 表（span-build-t1580.ts 產出）----
type KP = { kp: string; page: string; js: number; je: number; mode: string; title: string; srcTitle: string };
const kpSpan = new Map<string, KP>();
for (const r of JSON.parse(fs.readFileSync(`${SCR}/spans-t1580.json`, 'utf8')) as KP[]) kpSpan.set(r.kp, r);

// ---- 段落切分（每條段落記當下最內層科判）----
const lines = fs.readFileSync(`${VAULT}/T1580-1.md`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
type Para = { line: number; kp: string; text: string };
const paras: Para[] = [];
let curKp = '';
for (let i = 0; i < lines.length; i++) {
  const t = lines[i]!.trim();
  const hd = /^#{1,6}\s+.*?\^(kpD\d+-\d+)\s*$/.exec(t);
  if (hd) { curKp = hd[1]!; continue; }
  if (!t || /^《/.test(t) || /^\[\^/.test(t) || /^\|/.test(t) || /^(No\.|瑜伽師地論釋|最勝子|三藏法師)/.test(t)) continue;
  const prev = i > 0 ? lines[i - 1]!.trim() : '';
  if (prev && !/^《/.test(prev) && !/^\[\^/.test(prev) && !/^#/.test(prev) && !/^\|/.test(prev) && !/^(No\.|瑜伽師地論釋|最勝子|三藏法師)/.test(prev)) continue;
  const clean = hanOnly(t.replace(/\[\[[^\]]*\]\]/g, '').replace(/\^[A-Za-z0-9_-]+/g, ''));
  if (clean.length < 8) continue;
  paras.push({ line: i + 1, kp: curKp, text: clean });
}

// ---- Q 層滑窗 ----
const pageCache = new Map<string, string>();
type Q = { va: number; page: string; js: number; je: number; quote: string; ok: boolean; uniq: boolean };
const qOf = new Map<number, Q>();
let t0 = Date.now(), lastVa = lo30;
for (const p of paras) {
  let hitVa = -1, start = -1, len = 0;
  search: for (let st = 0; st + 8 <= p.text.length && st <= 16; st++) {
    for (const K of [24, 18, 14, 10, 8]) {              // 先打長窗：長者歧義低（短者會抓到平行文句）
      const cand = p.text.slice(st, st + K);
      if (cand.length < 8) continue;
      const v = await findHit(cand, lastVa);
      if (v == null) continue;
      let L = K;
      for (const step of [16, 8, 4, 2, 1]) for (;;) {
        const nx = p.text.slice(st, st + L + step);
        if (nx.length < L + step || L + step > 48) break;
        const res = await s.search(nx, 500);
        if (res.hits.some((h: { va: number }) => h.va === v)) { L += step; continue; }
        break;
      }
      hitVa = v; start = st; len = L; break search;
    }
  }
  if (hitVa < 0) continue;
  lastVa = hitVa;
  const page = pageOf(hitVa), quote = p.text.slice(start, start + len);
  const uniq = (await hitsInRange(quote)).length <= 1;   // 全書唯一 ⇒ 單調錨也失效時仍可信
  let ph = pageCache.get(page); if (ph === undefined) { ph = await pageHanTextOf(rd, page); pageCache.set(page, ph); }
  const js = ph.indexOf(quote);
  if (js < 0) { qOf.set(p.line, { va: hitVa, page, js: -1, je: -1, quote, ok: false, uniq }); continue; }
  const je = Math.min(js + len, ph.length);
  const res = await renderEmbed('taisho', page, '', `${js}-${je}`, '', false, rd as any);
  const win = hanOnly((/<div class="embedText reflow">([\s\S]*?)<\/div>/.exec(res.html)?.[1] ?? ''));
  qOf.set(p.line, { va: hitVa, page, js, je, quote, ok: win.startsWith(quote.slice(0, Math.min(6, quote.length))), uniq });
}

// ---- 合併兩層 ----
const out: string[] = ['line\tkp\tpage\tjs\tje\tmode\tquote'];
const rows: (string | number)[][] = [];
const tally: Record<string, number> = {};
for (const p of paras) {
  const kp = kpSpan.get(p.kp), q = qOf.get(p.line);
  const hasK = !!kp && kp.js >= 0;
  const agree = !!q && hasK && Math.abs(rank(q.page) - rank(kp!.page)) <= 2;
  let mode = 'none', page = '', js = -1, je = -1, quote = '', why = '科判無 span、段內無牒文';
  if (q && q.ok && (!hasK || agree) && (q.uniq || agree)) {
    mode = 'Q'; page = q.page; js = q.js; je = q.je; quote = q.quote;
    why = `逐字牒文 ${q.quote.length} 字${agree ? '（與科判 span 同欄，交叉印證）' : '（全書唯一命中）'}`;
  } else if (hasK) {
    mode = 'K'; page = kp!.page; js = kp!.js; je = kp!.je; quote = `${kp!.title}→「${kp!.srcTitle}」`;
    why = q ? `棄 Q（${q.page} 距科判 ${kp!.page} >2 欄${q.uniq ? '' : '，且 Q 非全書唯一'}）` : `科判 span（對齊 ${kp!.mode}）`;
  } else if (q && q.ok) {
    mode = 'drop'; page = q.page; quote = q.quote;
    why = 'Q 命中但非全書唯一、又無科判 span 可交叉印證 → 不出 ref（寧缺）';
  } else if (q) {
    mode = 'Q-link'; page = q.page; quote = q.quote; why = 'Q 窗未過 renderEmbed，僅頁欄聯';
  }
  tally[mode] = (tally[mode] ?? 0) + 1;
  out.push([p.line, p.kp, page, js, je, mode, quote].join('\t'));
  rows.push([p.line, p.kp, page, js, je, mode, quote, why, p.text.slice(0, 24)]);
}
const head = ['段起行', '所在科判', '大正頁欄', 'j起', 'j止', '層', '牒文/科判', '判定說明', '段落前24字'];
const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
fs.writeFileSync(`${SCR}/refs-t1580.tsv`, out.join('\n') + '\n', 'utf8');
fs.writeFileSync(`${SCR}/refs-t1580-review.csv`, '\uFEFF' + csv + '\r\n', 'utf8');
console.log(`論釋段 ${paras.length}：Q 逐字 ${qOf.size}（過驗 ${[...qOf.values()].filter((x) => x.ok).length}、全書唯一 ${[...qOf.values()].filter((x) => x.uniq).length}）｜${Object.entries(tally).map(([k, v]) => `${k}:${v}`).join('  ')}｜${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log('→ refs-t1580.tsv / refs-t1580-review.csv');
