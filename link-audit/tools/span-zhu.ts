#!/usr/bin/env bun
/**
 * P2 注文段落 ref —— 一般版（取代 span-t1580.ts 的單部寫法；T1580 走此路徑需復現 v17 的 35 條，作回归）。
 *
 * 用法：bun span-zhu.ts <SERIES>          →  refs-<SER>.tsv / refs-<SER>-review.csv
 *
 * 三層（優先序由資料可信度決定，不是由命中率決定）：
 *   A 層＝書內現掛（《[[T1579-x#^kpD…|瑜伽]]》《[[PXJ-H-x#^kpD…|披尋記]]》）——DILA 第一手對應，窗取自
 *          spans-j-verified.tsv（已逐條 renderEmbed）；已由 span-build-zhu.ts 折進 spans-<SER>.json（mode AT/AP）。
 *   K 層＝科判對齊（LCS＋缺口填補＋同子樹取窗＋祖先繼承）。
 *   Q 層＝段內滑窗逐字牒文（全書唯一 或 與科判 span 同頁欄 ±2 欄才採納，否則寧缺）。
 * 體量控制：全段滑窗只跑小部（T1580 92／T2801 666／T2259 1,227 段）；
 * 大部（T1828 11,328／PXJ-H 48,934／T1829／T2802）只對「…曰：」標記段跑滑窗——那是逐字牒文出現的位置。
 * 去重：披尋記科判行本身已掛 CBETA 聯＋嵌（build-ybh fam ''/漢），同科的段落不再重複發鏈（mode dup）。
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
const SER = process.argv[2] ?? 'T1580';
const FULL_Q = ['T1580', 'T2801', 'T2259'].includes(SER);
const DEDUPE = SER === 'PXJ-H';                    // 科判行已發鏈的部，段落不重複
const QMARK_ONLY = SER === 'T1828';                // 通篇引文的部：Q 只吃 曰/云 標記（成本控制）
const Q_MAX = 800;                                 // Q 層嘗試數上限（防跑不完）

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

// ---- 科判 span（A/K 層已在 span-build-zhu.ts 定好）----
type KP = { base: string; kp: string; page: string; js: number; je: number; mode: string; title: string; srcTitle: string };
const kpSpan = new Map<string, KP>();
for (const r of JSON.parse(fs.readFileSync(`${SCR}/zhu-spans-${SER}.json`, 'utf8')) as KP[]) kpSpan.set(`${r.base}#${r.kp}`, r);
// 去重用：本部科判行自己是否已有窗（build-ybh 對 fam ''/漢 發鏈的條件）
const headSpan = new Map<string, { page: string; js: number; je: number }>();
if (DEDUPE) {
  for (const ln of fs.readFileSync(`${SCR}/spans-j-verified.tsv`, 'utf8').split(/\r?\n/).slice(1)) {
    const c = ln.split('\t');
    if (c.length < 6 || c[0] !== 'PXJ' || !c[3] || c[4] === '' || c[5] === '' || !/^(T|N)/.test(c[6] ?? '')) continue;
    headSpan.set(`${c[1]}#${c[2]}`, { page: c[3]!, js: +c[4]!, je: +c[5]! });
  }
}

// ---- 段落切分 ----
const files = fs.readdirSync(VAULT).filter((f) => new RegExp(`^${SER.replace(/-/g, '\\-')}-\\d+\\.md$`).test(f))
  .sort((a, b) => +/-(\d+)\.md$/.exec(a)![1]! - +/-(\d+)\.md$/.exec(b)![1]!);
type Para = { base: string; line: number; kp: string; text: string; src: string; ownAnc?: { page: string; js: number; je: number; self: boolean } };
const paras: Para[] = [];
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const lines = fs.readFileSync(`${VAULT}/${f}`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  let curKp = '';
  const stk: { d: number; kp: string }[] = [];              // 科判深度棧，供「祖先自窗」回溯
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.trim();
    const hd = /^(#{1,6})\s+.*?\^(kpD\d+-\d+)\s*$/.exec(t);
    if (hd) {
      curKp = hd[2]!;
      const d = hd[1]!.length;
      while (stk.length && stk[stk.length - 1]!.d >= d) stk.pop();
      stk.push({ d, kp: curKp });
      continue;
    }
    if (!t || /^《/.test(t) || /^\[\^/.test(t) || /^\|/.test(t) || /^\[?\d/.test(t) || /^(卷第|No\.|[\u4e00-\u9fff]{2,}造|[\u4e00-\u9fff]{2,}譯)/.test(t)) continue;
    const prev = i > 0 ? lines[i - 1]!.trim() : '';
    if (prev && !/^《/.test(prev) && !/^\[\^/.test(prev) && !/^#/.test(prev) && !/^\|/.test(prev) && !/^\[?\d/.test(prev) && !/^(卷第|No\.|[\u4e00-\u9fff]{2,}造|[\u4e00-\u9fff]{2,}譯)/.test(prev)) continue;
    const src = t.replace(/\[\[[^\]]*\]\]/g, '').replace(/\^[A-Za-z0-9_-]+/g, '').replace(/\[[^\]]*\]/g, '');
    const clean = hanOnly(src);
    if (clean.length < 8) continue;
    // 題簽/譯名行不是釋文段（如「三藏法師玄奘奉　詔譯」「最勝子等諸菩薩造」）
    if (/(奉\s*詔譯|詔譯|菩薩造|三藏法師|沙門[\u4e00-\u9fff]{2,4}(譯|造))$/.test(clean)) continue;
    if (clean.length <= 20 && /^(瑜伽師地論|瑜伽論|No\.|卷第|本地分中)/.test(clean)) continue;   // 題簽行（短片語），長段不誤殺
    let ownAnc: Para['ownAnc'];
    if (DEDUPE) for (let k = stk.length - 1; k >= 0; k--) {
      const w = headSpan.get(`${base}#${stk[k]!.kp}`);
      if (w) { ownAnc = { page: w.page, js: w.js, je: w.je, self: k === stk.length - 1 }; break; }
    }
    paras.push({ base, line: i + 1, kp: curKp, text: clean, src, ownAnc });
  }
}

// ---- Q 層（滑窗牒文）----
const pageCache = new Map<string, string>();
type Q = { va: number; page: string; js: number; je: number; quote: string; ok: boolean; uniq: boolean };
const qOf = new Map<string, Q>();
let t0 = Date.now(), lastVa = lo30, tried = 0;
async function slide(p: Para, from: number, txt?: string) {
  const T = txt ?? p.text;
  tried++;
  let hitVa = -1, start = -1, len = 0;
  search: for (let st = from; st + 8 <= T.length && st <= from + 16; st++) {
    for (const K of [24, 18, 14, 10, 8]) {
      const cand = T.slice(st, st + K);
      if (cand.length < 8) continue;
      const vas = (await hitsInRange(cand)).filter((v) => v >= lastVa).sort((a, b) => a - b);
      if (!vas.length) continue;
      const v = vas[0]!;
      let L = K;
      for (const step of [16, 8, 4, 2, 1]) for (;;) {
        const nx = T.slice(st, st + L + step);
        if (nx.length < L + step || L + step > 48) break;
        const res = await s.search(nx, 500);
        if (res.hits.some((h: { va: number }) => h.va === v)) { L += step; continue; }
        break;
      }
      hitVa = v; start = st; len = L; break search;
    }
  }
  if (hitVa < 0) return;
  lastVa = hitVa;
  const page = pageOf(hitVa), quote = T.slice(start, start + len);
  const uniq = (await hitsInRange(quote)).length <= 1;
  let ph = pageCache.get(page); if (ph === undefined) { ph = await pageHanTextOf(rd, page); pageCache.set(page, ph); }
  const js = ph.indexOf(quote);
  if (js < 0) { qOf.set(`${p.base}#${p.line}`, { va: hitVa, page, js: -1, je: -1, quote, ok: false, uniq }); return; }
  const je = Math.min(js + len, ph.length);
  const res = await renderEmbed('taisho', page, '', `${js}-${je}`, '', false, rd as any);
  const mark = hanOnly(/<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '');
  qOf.set(`${p.base}#${p.line}`, { va: hitVa, page, js, je, quote, ok: mark.startsWith(quote.slice(0, Math.min(6, quote.length))), uniq });
}
for (const p of paras) {
  if (FULL_Q) { await slide(p, 0); continue; }
  if (tried >= Q_MAX) continue;                                // Q 層預算：超過就不再嘗試（大部以 K/A 為主）
  // 大部只試「有標記處」：① …曰：/…云：之後；② 「…」『…』括起的引文（≥12 字）。
  // 標點要先留在原文裡找（hanOnly 會把「：」洗掉，v18 前因此漏光——實測 Q 嘗試 0）。
  // T1828（瑜伽論記）通篇是引文：只吃曰/云標記，不退到引文括號，否則嘗試數破五千、40 分鐘跑不完。
  const mi = QMARK_ONLY ? null : (/[曰云]：/.exec(p.src) ?? null);
  const mk = QMARK_ONLY ? /[曰云]：/.exec(p.src) : mi;
  let mt = mk ? hanOnly(p.src.slice(mk.index + 2)) : '';
  if (mt.length < 8 && !QMARK_ONLY) {
    const qs = [...p.src.matchAll(/[「『]([^」』]{12,})[」』]/g)].map((x) => hanOnly(x[1]!)).sort((a, b) => b.length - a.length)[0] ?? '';
    if (qs.length > mt.length) mt = qs;
  }
  if (mt.length >= 8) await slide(p, 0, mt);
}

// ---- 合併 ----
const out: string[] = ['base\tline\tkp\tpage\tjs\tje\tmode\tquote'];
const rows: (string | number)[][] = [];
const tally: Record<string, number> = {};
for (const p of paras) {
  const key = `${p.base}#${p.line}`;
  let kp = kpSpan.get(`${p.base}#${p.kp}`);
  const q = qOf.get(key);
  // 披尋記这类「科判行已自掛 CBETA 窗」的部：段落的第一手依据是**本書科文自己的窗**
  // （spans-j-verified lib=PXJ，29,433 條已逐條驗過）。自己那層有窗→段落不重複（dup）；
  // 自己沒窗而祖先有→用祖先自窗（mode O，比 T1579 標題對齊更貼本書）；整條鏈都沒窗→才退回對齊表。
  if (DEDUPE && p.ownAnc && !p.ownAnc.self) kp = { base: p.base, kp: p.kp, page: p.ownAnc.page, js: p.ownAnc.js, je: p.ownAnc.je, mode: 'O', title: '祖先科文自窗', srcTitle: '' };
  const hasK = !!kp && kp.js >= 0;
  const kpFine = hasK && kp!.mode !== 'K';                 // 直接對齊/現掛/自窗＝細；K＝祖先對齊（粗）
  const agree = !!q && hasK && Math.abs(rank(q.page) - rank(kp!.page)) <= 2;
  let mode = 'none', page = '', js = -1, je = -1, quote = '', why = '科判無 span、段內無牒文';
  // 取捨（v18 修正）：同欄→Q（較細且互證）；不同欄時「粗 K 遇全書唯一 Q」讓 Q 贏
  // （分門記這類科判稀疏的部，祖先窗會落在一地開頭，逐字唯一命中更貼段意）；
  // 「細 K 遇不同欄 Q」讓 K 贏——實證：論釋 p328c 三摩呬多段的「謂靜慮解脫等持等至」
  // 在 T1579 全書僅 1 處卻在 p504c 菩薩地十力種姓，屬同字不同境的假性唯一。
  const qWins = !!q && q.ok && (agree || (!kpFine && q.uniq) || !hasK);
  if (DEDUPE && p.ownAnc?.self) { mode = 'dup'; why = '本部科判行已自掛同窗（科文→原文），段落不重複發鏈'; }
  else if (qWins) {
    mode = 'Q'; page = q!.page; js = q!.js; je = q!.je; quote = q!.quote;
    why = `逐字牒文 ${q!.quote.length} 字${agree ? '（與科判 span 同欄，交叉印證）' : q!.uniq ? '（科判窗為祖先繼承，改取全書唯一逐字命中）' : '（所在科判無 span）'}`;
  } else if (hasK) {
    mode = kp!.mode.startsWith('A') ? 'A' : kp!.mode === 'O' ? 'O' : 'K';
    page = kp!.page; js = kp!.js; je = kp!.je; quote = `${kp!.title}→「${kp!.srcTitle}」`;
    why = q ? `棄 Q（${q.page} 距科判 ${kp!.page} >2 欄，科判為${kpFine ? '直接對齊' : '祖先繼承但 Q 非唯一'}）` : `科判 span（來源 ${kp!.mode}）`;
  } else if (q && q.ok) { mode = 'drop'; page = q.page; quote = q.quote; why = 'Q 命中但非唯一、又無科判交叉印證 → 寧缺'; }
  else if (q) { mode = 'Q-link'; page = q.page; quote = q.quote; why = 'Q 窗未過 renderEmbed，僅頁欄聯'; }
  tally[mode] = (tally[mode] ?? 0) + 1;
  if (mode === 'none' || mode === 'drop' || mode === 'dup') continue;
  out.push([p.base, p.line, p.kp, page, js, je, mode, quote].join('\t'));
  rows.push([p.base, p.line, p.kp, page, js, je, mode, quote, why, p.text.slice(0, 24)]);
}
const head = ['卷檔', '段起行', '所在科判', '大正頁欄', 'j起', 'j止', '層', '牒文/科判', '判定說明', '段落前24字'];
const csv = [head, ...rows].map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
fs.writeFileSync(`${SCR}/zhu-refs-${SER}.tsv`, out.join('\n') + '\n', 'utf8');
fs.writeFileSync(`${SCR}/zhu-refs-${SER}-review.csv`, '\uFEFF' + csv + '\r\n', 'utf8');
console.log(`【${SER}】段落 ${paras.length}｜Q 嘗試 ${tried}（命中 ${qOf.size}、過驗 ${[...qOf.values()].filter((x) => x.ok).length}）｜${Object.entries(tally).map(([k, v]) => `${k}:${v}`).join('  ')}｜實發 ${out.length - 1} 條｜${((Date.now() - t0) / 1000).toFixed(0)}s`);
console.log(`→ zhu-refs-${SER}.tsv / zhu-refs-${SER}-review.csv`);
