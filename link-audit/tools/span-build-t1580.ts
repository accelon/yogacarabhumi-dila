#!/usr/bin/env bun
/**
 * P2 論釋段落 ref 前置件 v4：T1580 科判 → 原文（T1579 DILA 科判 → CBETA 已驗 j 窗）對齊表。
 *
 * 為什麼不是逐字：論釋是義引。段起/滑窗逐字只命中《瑜伽師地論釋》自身
 * （CBETA 30p883a 起，在 T1579 書區 [45128898,46091786) 之外），
 * 92 段裡落在論文書區者僅 3 段。故改走科判對齊（定案稿 §1「每段注文錨定到原文 span（或科文節點）」）。
 *
 * 對齊法（v4，取代 v3 的貪婪前推——貪婪會被前置的泛稱/同名句錯指拖垮）：
 *   1) 具體標題（≥3 漢字且非泛稱表內者）與 T1579 科判序列求 **最長公共子序列**
 *      ——天然單調、自動跳過假性早配，100×11291 格，秒級。
 *   2) 未進 LCS 的科判在「相鄰兩個 LCS 錨」界定的缺口內找：先全等、再子串、
 *      再退到「首個地字為止」的关键词（意地 ↔ 本地分中意地第二之一）。
 *   3) 命中節點若無窗，取其子樹（同卷、更深）第一個有窗者（= 該科所牒原文的起點）。
 *      窗一律取自 spans-j-verified.tsv（26,066 條已逐條過 renderEmbed）。
 *   4) 仍無者 mode K：繼承文檔序上最近的已窗錨；完全無錨 → no（不編造）。
 * 輸出 spans-t1580.json ＋ spans-t1580-audit.tsv（99 條全列人工覆核）。
 */
import fs from 'node:fs';

const VAULT = 'D:/2026/yogacarabhumi-dila';
const SCR = 'D:/2026/_scratch-ybh';

const GENERIC = new Set(['總說', '別釋', '結', '徵', '顯', '問', '答', '頌', '長行', '自性', '所依', '所緣', '所為', '師', '論', '體', '宗要', '藏攝', '料簡']);

function normTitle(t: string): string {
  let s = t.replace(/\s*\^[A-Za-z0-9_-]+\s*$/, '');
  s = s.replace(/^#+\s*/, '');
  s = s.replace(/^[A-Za-z]{1,2}\d*(?:-\d+)?[ .、\s]*/, '');            // 字母層級序 A1／E1-2／C3-5
  s = s.replace(/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{1,2}[一二三四五六七八九十百]*[、.\s]*/, '');
  s = s.replace(/[（(][^）)]*[）)]/g, '');
  s = s.replace(/[「」『』《》【】]/g, '');
  return s.replace(/[^一-鿿]/g, '');
}

// ---- T1579 科判序列（卷號→行號＝文件序）----
type H = { base: string; v: number; line: number; kp: string; nt: string; raw: string; d: number };
const vols = fs.readdirSync(VAULT).filter((f) => /^T1579-\d+\.md$/.test(f))
  .map((f) => ({ f, v: +/^T1579-(\d+)\.md$/.exec(f)![1]! })).sort((a, b) => a.v - b.v);
const Hs: H[] = [];
for (const { f, v } of vols) {
  const base = `T1579-${v}`;
  fs.readFileSync(`${VAULT}/${f}`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
    .forEach((ln, i) => {
      const m = /^(#{1,6})\s+(.+?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln.trim());
      if (!m) return;
      const nt = normTitle(m[2]!);
      if (nt) Hs.push({ base, v, line: i + 1, kp: m[3]!, nt, raw: m[2]!, d: m[1]!.length });
    });
}
const subEnd = Hs.map((h, i) => { let j = i + 1; for (; j < Hs.length; j++) if (Hs[j]!.v !== h.v || Hs[j]!.d <= h.d) break; return j; });

// ---- 已驗 j 窗 ----
const span = new Map<string, { page: string; js: number; je: number; mode: string }>();
for (const ln of fs.readFileSync(`${SCR}/spans-j-verified.tsv`, 'utf8').split(/\r?\n/).slice(1)) {
  const c = ln.split('\t');
  if (c.length < 6 || c[0] !== 'T1579' || !c[3] || c[4] === '' || c[5] === '') continue;
  if (/^(T|N)/.test(c[6] ?? '')) span.set(`${c[1]}#${c[2]}`, { page: c[3]!, js: +c[4]!, je: +c[5]!, mode: c[6]! });
}
const winAt = (i: number) => span.get(`${Hs[i]!.base}#${Hs[i]!.kp}`);
/** 自身→子樹第一個有窗者。同卷放寬已移除：放寬會抓到「隔壁科」的窗（如就喻相…抓到 B2 意地），
 *  寧可標無窗、由祖先鏈或 Q 層接手，也不出錯指的窗。 */
function resolveWin(i: number): { sp: { page: string; js: number; je: number; mode: string }; src: string; at: number } | null {
  const own = winAt(i);
  if (own) return { sp: own, src: 'own', at: i };
  for (let j = i + 1; j < subEnd[i]!; j++) { const s = winAt(j); if (s) return { sp: s, src: 'd', at: j }; }
  return null;
}

// ---- T1580 科判 ----
const t1580 = fs.readFileSync(`${VAULT}/T1580-1.md`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')
  .map((ln, i) => ({ i, m: /^(#{1,6})\s+(.+?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln.trim()) }))
  .filter((x) => x.m)
  .map((x) => ({ line: x.i + 1, kp: x.m![3]!, title: x.m![2]!, nt: normTitle(x.m![2]!), d: x.m![1]!.length }));

// ---- 1) 具體標題 LCS ----
const specIdx: number[] = [];
t1580.forEach((r, i) => { if (r.nt.length >= 3 && !GENERIC.has(r.nt)) specIdx.push(i); });
const A = specIdx.map((i) => t1580[i]!.nt), B = Hs.map((h) => h.nt);
const n = A.length, m = B.length;
const dp = new Uint8Array((n + 1) * (m + 1));               // LCS ≤ 99，Uint8 足夠
const at = (r: number, c: number) => dp[r * (m + 1) + c]!;
for (let i = n - 1; i >= 0; i--) {
  for (let j = m - 1; j >= 0; j--) {
    const best = Math.max(at(i + 1, j), at(i, j + 1));
    dp[i * (m + 1) + j] = A[i] === B[j] ? Math.max(best, (at(i + 1, j + 1) as number) + 1) : best;
  }
}
const lcs = new Map<number, number>();                       // t1580 序號 → Hs 序號
{ let i = 0, j = 0; while (i < n && j < m) { if (A[i] === B[j] && at(i, j) === at(i + 1, j + 1) + 1) { lcs.set(specIdx[i]!, j); i++; j++; } else if (at(i + 1, j) >= at(i, j + 1)) i++; else j++; } }

// ---- 2) 缺口填補 ----
const matched = new Map<number, { at: number; kind: string }>();
lcs.forEach((hv, av) => matched.set(av, { at: hv, kind: 'L' }));
const anchorList = [...lcs.keys()].sort((a, b) => a - b);
const keyOf = (nt: string) => { const k = nt.indexOf('地'); return k >= 2 ? nt.slice(0, k + 1) : ''; };
t1580.forEach((r, i) => {
  if (matched.has(i)) return;
  let prevA: number | undefined, nextA: number | undefined;
  for (const x of anchorList) { if (x < i) prevA = x; else { nextA = x; break; } }
  const lo = prevA === undefined ? 0 : (matched.get(prevA)!.at);
  const hi = nextA === undefined ? Hs.length - 1 : (matched.get(nextA)!.at);
  if (hi <= lo) return;
  let pick = -1, kind = '';
  for (let j = lo; j <= hi; j++) if (Hs[j]!.nt === r.nt && resolveWin(j)) { pick = j; kind = 'E'; break; }
  if (pick < 0 && r.nt.length >= 3) for (let j = lo; j <= hi; j++) if (Hs[j]!.nt.length > r.nt.length && Hs[j]!.nt.includes(r.nt) && resolveWin(j)) { pick = j; kind = 'S'; break; }
  const kk = keyOf(r.nt);
  if (pick < 0 && kk.length >= 3) for (let j = lo; j <= hi; j++) if (Hs[j]!.nt.includes(kk) && resolveWin(j)) { pick = j; kind = 'D'; break; }
  // 十七地專則：標題以「地」收尾（意地／聲聞地…）→ 找同范围内的卷首科判「本地分中○地第N」
  if (pick < 0 && r.nt.length >= 2 && r.nt.endsWith('地')) {
    for (let j = lo; j <= hi; j++) if (/^本地分中.*地第/.test(Hs[j]!.nt) && Hs[j]!.nt.includes(r.nt) && resolveWin(j)) { pick = j; kind = 'P'; break; }
  }
  if (pick >= 0) matched.set(i, { at: pick, kind });
});

// ---- 3) 先算每條科判自己的窗（命中且可解析）----
type W = { page: string; js: number; je: number };
const ownWin: (W & { mode: string; note: string; h?: H; src?: H })[] = t1580.map((r, i) => {
  const mm = matched.get(i);
  const rw = mm ? resolveWin(mm.at) : null;
  if (!mm) return { page: '', js: -1, je: -1, mode: 'no', note: '未對齊' };
  if (!rw) return { page: '', js: -1, je: -1, mode: mm.kind + '?', note: '命中但子樹／同卷皆無窗' };
  return { page: rw.sp.page, js: rw.sp.js, je: rw.sp.je, mode: mm.kind + rw.src, note: '', h: Hs[mm.at], src: Hs[rw.at] };
});

// ---- 4) 未取窗者：沿 T1580 自身科判樹**向上找祖先**（不橫向亂繼承）----
const stack: number[] = [];                                    // 深度遞增的祖先索引棧
const out: { kp: string; page: string; js: number; je: number; mode: string; title: string; srcTitle: string }[] = [];
const audit: string[] = ['t1580_line\tt1580_kp\tt1580_title\tmode\t1579卷\t1579_kp\t1579標題\t窗源\t1579窗標題\tpage\tjs\tje\t說明'];
const tally: Record<string, number> = {};
t1580.forEach((r, i) => {
  while (stack.length && t1580[stack[stack.length - 1]!]!.d >= r.d) stack.pop();
  let rec = { kp: r.kp, page: ownWin[i]!.page, js: ownWin[i]!.js, je: ownWin[i]!.je, mode: ownWin[i]!.mode, title: r.title.trim(), srcTitle: ownWin[i]!.src?.raw?.trim() ?? '' };
  let note = ownWin[i]!.note;
  if (rec.js < 0) {                                            // 祖先鏈向後找第一個有窗者
    for (let k = stack.length - 1; k >= 0; k--) {
      const a = ownWin[stack[k]!]!;
      if (a.js >= 0) {
        rec = { kp: r.kp, page: a.page, js: a.js, je: a.je, mode: 'K', title: r.title.trim(), srcTitle: a.src?.raw?.trim() ?? '' };
        note = `祖先 L${t1580[stack[k]!]!.line}「${t1580[stack[k]!]!.title.trim()}」`;
        break;
      }
    }
    if (rec.js < 0) { rec.mode = 'no'; note = '自身與祖先皆無錨（六門料簡等非釋本文段）'; }
  }
  stack.push(i);
  tally[rec.mode] = (tally[rec.mode] ?? 0) + 1;
  out.push(rec);
  const ow = ownWin[i]!;
  audit.push([r.line, r.kp, r.title, rec.mode, ow.h ? String(ow.h.v) : '', ow.h?.kp ?? '', ow.h?.nt ?? '', ow.mode.includes('?') || ow.mode === 'no' ? '' : (ow.src ? String(ow.src.line) : ''),
    ow.src?.raw ?? '', rec.page, rec.js, rec.je, note].join('\t'));
});
fs.writeFileSync(`${SCR}/spans-t1580.json`, JSON.stringify(out, null, 0), 'utf8');
fs.writeFileSync(`${SCR}/spans-t1580-audit.tsv`, audit.join('\n') + '\n', 'utf8');
console.log(`T1579 科判 ${Hs.length}（已驗窗 ${span.size}）｜LCS 具體錨 ${lcs.size}/${n}｜T1580 科判 ${t1580.length}：`,
  Object.entries(tally).map(([k, v]) => `${k}:${v}`).join('  '));
console.log('→ spans-t1580.json / spans-t1580-audit.tsv');
