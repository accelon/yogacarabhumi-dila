#!/usr/bin/env bun
/**
 * P2 注文段落 ref —— 科判對齊（一般版，取代 span-build-t1580.ts 的單部寫法）。
 *
 * 用法：bun span-build-zhu.ts <SERIES> [卷檔前綴]     →  spans-<SER>.json / spans-<SER>-audit.tsv
 *
 * 規則（與 §16.21 定案一致，只是換部書跑）：
 *   1) 標題正規化：去層級前綴（字母 A1/E1-2、干支 甲三）、去括注、去書名號、只留漢字。
 *   2) 對齊＝LCS，實作换成 **候選對 + LIS（patience 排序）**：10k×11k 的 DP 表會吃到上百 MB，
 *      而「標題→位置倒排＋最長遞增鏈」同解且只隨命中對數成長。泛稱（總說/別釋/徵/顯…、<3 字）不入 LCS，
 *      避免高頻標題撐出假鏈。
 *   3) 未入鏈者在「相鄰兩錨」界定的缺口內找：全等 → 子串 → 「首個地字」關鍵詞 → 十七地卷首式（P 規則）。
 *   4) 取窗只准**同子樹**（自身→同卷更深子樹第一個有窗者）；同卷放寬會抓到隔壁科，已禁。
 *      窗一律取自 spans-j-verified.tsv（已逐條過 renderEmbed 的 26,066 條）。
 *   5) 仍無窗者沿本書科判樹**向上找祖先**（mode K，註明祖先行號）；祖先也沒有 → no（誠實留白）。
 */
import fs from 'node:fs';

const VAULT = 'D:/2026/yogacarabhumi-dila';
const SCR = 'D:/2026/_scratch-ybh';
const SER = process.argv[2] ?? 'T1580';

const GENERIC = new Set(['總說', '別釋', '結', '徵', '顯', '問', '答', '頌', '長行', '自性', '所依', '所緣', '所為', '師', '論', '體', '宗要', '藏攝', '料簡']);

function normTitle(t: string): string {
  let s = t.replace(/\s*\^[A-Za-z0-9_-]+\s*$/, '');
  s = s.replace(/^#+\s*/, '');
  s = s.replace(/^[A-Za-z]{1,2}\d*(?:-\d+)?[ .、\s]*/, '');
  s = s.replace(/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥]{1,2}[一二三四五六七八九十百]*[、.\s]*/, '');
  s = s.replace(/[（(][^）)]*[）)]/g, '');
  s = s.replace(/[「」『』《》【】]/g, '');
  return s.replace(/[^一-鿿]/g, '');
}

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

const span = new Map<string, { page: string; js: number; je: number; mode: string }>();
for (const ln of fs.readFileSync(`${SCR}/spans-j-verified.tsv`, 'utf8').split(/\r?\n/).slice(1)) {
  const c = ln.split('\t');
  if (c.length < 6 || c[0] !== 'T1579' || !c[3] || c[4] === '' || c[5] === '') continue;
  if (/^(T|N)/.test(c[6] ?? '')) span.set(`${c[1]}#${c[2]}`, { page: c[3]!, js: +c[4]!, je: +c[5]!, mode: c[6]! });
}
// D 層：spans-j-verified 全量窗（T1579＋PXJ 兩套），供書內現成跨庫掛鏈解析
const anyWin = new Map<string, { page: string; js: number; je: number; mode: string }>();
const baseRanks = new Map<string, number[]>();               // 該卷所有已驗窗的頁欄序（取中位數當錨帶）
const rankRaw = (p: string) => +(/30p(\d+)/.exec(p)?.[1] ?? NaN) * 10 + 'abc'.indexOf(p.slice(-1));
for (const ln of fs.readFileSync(`${SCR}/spans-j-verified.tsv`, 'utf8').split(/\r?\n/).slice(1)) {
  const c = ln.split('\t');
  if (c.length < 6 || !c[3] || c[4] === '' || c[5] === '' || !/^(T|N)/.test(c[6] ?? '')) continue;
  anyWin.set(`${c[1]}#${c[2]}`, { page: c[3]!, js: +c[4]!, je: +c[5]!, mode: c[6]! });
  const a = baseRanks.get(c[1]!) ?? []; a.push(rankRaw(c[3]!)); baseRanks.set(c[1]!, a);
}
/** 合理性閘：一卷的窗應聚在該卷對應的論文頁帶內。偏離中位數 >40 頁即判不可信
 *  （實測披尋記卷一 600 餘窗全在 279a–283c，唯 3 條「嗢柁南」类短語窗落到 424a/493a/807b——
 *   那是全書反覆出現的詞被單調前推讓給別卷平行文句，不是真對應）。窗數 <8 的小卷不設閘。 */
const baseMed = new Map<string, number>();
for (const [b, a] of baseRanks) if (a.length >= 8) { a.sort((x, y) => x - y); baseMed.set(b, a[a.length >> 1]!); }
function plausible(base: string, page: string): boolean {
  const m = baseMed.get(base);
  if (m === undefined) return true;
  return Math.abs(rankRaw(page) - m) <= 400;
}
const winAt = (i: number) => span.get(`${Hs[i]!.base}#${Hs[i]!.kp}`);
function resolveWin(i: number): { sp: { page: string; js: number; je: number; mode: string }; src: string; at: number } | null {
  const own = winAt(i);
  if (own) return { sp: own, src: 'own', at: i };
  for (let j = i + 1; j < subEnd[i]!; j++) { const s = winAt(j); if (s) return { sp: s, src: 'd', at: j }; }
  return null;
}

// ---- 本書（SER）科判 ----
const files = fs.readdirSync(VAULT).filter((f) => new RegExp(`^${SER.replace(/-/g, '\\-')}-\\d+\\.md$`).test(f))
  .sort((a, b) => +/-(\d+)\.md$/.exec(a)![1]! - +/-(\d+)\.md$/.exec(b)![1]!);
const my: { base: string; line: number; kp: string; title: string; nt: string; d: number; dw?: { page: string; js: number; je: number; mode: string }; dl?: string; nk?: string }[] = [];
let dGateN = 0;                    // 合理性閘擋下的現掛鏈數
const DLINK = /^《\[\[(T1579-\d+|PXJ-H-\d+)#\^(kpD\d+-\d+)(?:[^\]]*)\]\]》\s*$/;
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const ls = fs.readFileSync(`${VAULT}/${f}`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  ls.forEach((ln, i) => {
    const m = /^(#{1,6})\s+(.+?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln.trim());
    if (!m) return;
    const rec: typeof my[0] = { base, line: i + 1, kp: m[3]!, title: m[2]!, nt: normTitle(m[2]!), d: m[1]!.length };
    // D 層：標題正下方連續的 《[[系列#^kpD|…]》 掛鏈。
    // 優先序寫死：**T1579 直掛（AT）> 披尋記轉掛（AP）**——AP 要多跳一層（披尋記自己的窗），
    // 而披尋記表裡有若干「嗢柁南」这类全書反覆出現的詞，其窗經逐字驗證落在別卷平行文句
    // （實測 PXJ-H-1#kpD05-001 → 30p424a#165-169），拿來當論釋「F1 頌」的錨就偏了。
    let apw: { page: string; js: number; je: number; mode: string } | null = null, apl = '';
    for (let j = i + 1; j < ls.length; j++) {
      const x = ls[j]!.trim();
      if (/^#{1,6}\s/.test(x) || !x) { if (/^#{1,6}\s/.test(x)) break; continue; }
      if (!/^《\[\[/.test(x)) break;
      const dm = DLINK.exec(x);
      if (!dm) continue;
      const w = anyWin.get(`${dm[1]}#${dm[2]}`);
      if (!w) continue;
      if (!plausible(dm[1]!, w.page)) { dGateN++; continue; }
      if (dm[1]!.startsWith('T1579')) { rec.dw = w; rec.dl = x.replace(/^《\[\[|\]\]》$/g, ''); rec.nk = dm[1] + '#' + dm[2]; break; }
      if (!apw) { apw = w; apl = x.replace(/^《\[\[|\]\]》$/g, ''); }
    }
    if (!rec.dw && apw) { rec.dw = apw; rec.dl = apl; }
    my.push(rec);
  });
}

// ---- LCS via 候補對 + LIS ----
const pos = new Map<string, number[]>();
Hs.forEach((h, i) => { const a = pos.get(h.nt) ?? []; a.push(i); pos.set(h.nt, a); });
type Pair = { a: number; b: number };
const pairs: Pair[] = [];
my.forEach((r, i) => { if (r.nt.length >= 3 && !GENERIC.has(r.nt)) { for (const j of pos.get(r.nt) ?? []) pairs.push({ a: i, b: j }); } });
// 同 a 只可取一：以 (a 升, b 降) 排序後對 b 求嚴格遞增 LIS
pairs.sort((x, y) => x.a - y.a || y.b - x.b);
const tails: number[] = [], tailIdx: number[] = [], prev = new Int32Array(pairs.length).fill(-1);
for (let k = 0; k < pairs.length; k++) {
  const b = pairs[k]!.b;
  let lo = 0, hi = tailIdx.length;                     // 二分：找第一條尾 >= b（嚴格遞增 → 用 lowerBound on >=）
  while (lo < hi) { const m = (lo + hi) >> 1; if (tails[m]! < b) lo = m + 1; else hi = m; }
  prev[k] = lo > 0 ? tailIdx[lo - 1]! : -1;
  if (lo === tailIdx.length) { tails.push(b); tailIdx.push(k); } else { tails[lo] = b; tailIdx[lo] = k; }
}
const lcs = new Map<number, number>();                 // 本書序 → Hs 序
if (tailIdx.length) { let k = tailIdx[tailIdx.length - 1]!; for (; k >= 0; k = prev[k]!) lcs.set(pairs[k]!.a, pairs[k]!.b); }

const matched = new Map<number, { at: number; kind: string }>();
lcs.forEach((hv, av) => matched.set(av, { at: hv, kind: 'L' }));
const anchorList = [...lcs.keys()].sort((x, y) => x - y);
const keyOf = (nt: string) => { const k = nt.indexOf('地'); return k >= 2 ? nt.slice(0, k + 1) : ''; };
my.forEach((r, i) => {
  if (matched.has(i)) return;
  let prevA: number | undefined, nextA: number | undefined;
  for (const x of anchorList) { if (x < i) prevA = x; else { nextA = x; break; } }
  const lo = prevA === undefined ? 0 : matched.get(prevA)!.at;
  const hi = nextA === undefined ? Hs.length - 1 : matched.get(nextA)!.at;
  if (hi <= lo) return;
  let pick = -1, kind = '';
  for (let j = lo; j <= hi; j++) if (Hs[j]!.nt === r.nt && resolveWin(j)) { pick = j; kind = 'E'; break; }
  if (pick < 0 && r.nt.length >= 3) for (let j = lo; j <= hi; j++) if (Hs[j]!.nt.length > r.nt.length && Hs[j]!.nt.includes(r.nt) && resolveWin(j)) { pick = j; kind = 'S'; break; }
  const kk = keyOf(r.nt);
  if (pick < 0 && kk.length >= 3) for (let j = lo; j <= hi; j++) if (Hs[j]!.nt.includes(kk) && resolveWin(j)) { pick = j; kind = 'D'; break; }
  if (pick < 0 && r.nt.length >= 2 && r.nt.endsWith('地')) {
    for (let j = lo; j <= hi; j++) if (/^本地分中.*地第/.test(Hs[j]!.nt) && Hs[j]!.nt.includes(r.nt) && resolveWin(j)) { pick = j; kind = 'P'; break; }
  }
  if (pick >= 0) matched.set(i, { at: pick, kind });
});

// ---- 取窗：D 層（書內現掛）優先 → LCS/缺口 → 祖先繼承 ----
let agreeN = 0, disagreeN = 0, apOverrideN = 0;
const rankOf = (p: string) => +(/30p(\d+)/.exec(p)?.[1] ?? NaN) * 10 + 'abc'.indexOf(p.slice(-1));
const ownWin = my.map((r, i) => {
  const mm = matched.get(i);
  const rw = mm ? resolveWin(mm.at) : null;
  // 融合目標節點錨（P4 <融 i="ybh?…">）：T1579 直掛鏈優先，其次取對齊到的 T1579 節點
  const nkOf = (): string => r.nk ?? (mm ? `${Hs[mm.at]!.base}#${Hs[mm.at]!.kp}` : '');
  const dlOf = (): string => (r.dl && r.dl.includes('|') ? r.dl.split('|').pop()! : (r.dl ?? ''));
  if (r.dw) {                                            // 第一手：DILA 自己標的對應
    if (rw) { if (rw.sp.page === r.dw.page && rw.sp.js === r.dw.js) agreeN++; else disagreeN++; }
    // AP（經披尋記轉掛）若與直接對齊差 >2 欄，改用直接對齊——轉掛多一層，平行文句風險高
    if (rw && r.dl!.startsWith('PXJ-H') && Math.abs(rankOf(r.dw.page) - rankOf(rw.sp.page)) > 2) {
      apOverrideN++;
      return { page: rw.sp.page, js: rw.sp.js, je: rw.sp.je, mode: mm!.kind + rw.src, note: `AP 距對齊窗 >2 欄，改採 ${mm!.kind}`, h: Hs[mm!.at], src: Hs[rw.at], nk: nkOf() };
    }
    return { page: r.dw.page, js: r.dw.js, je: r.dw.je, mode: 'A' + (r.dl!.startsWith('T1579') ? 'T' : 'P'), note: `書內現掛 ${r.dl}`, h: mm ? Hs[mm.at] : undefined, src: rw ? Hs[rw.at] : undefined, nk: nkOf(), dlLabel: dlOf() };
  }
  if (!mm) return { page: '', js: -1, je: -1, mode: 'no', note: '未對齊', h: undefined as H | undefined, src: undefined as H | undefined, nk: '' };
  if (!rw) return { page: '', js: -1, je: -1, mode: mm.kind + '?', note: '命中但子樹無窗', h: Hs[mm.at], src: undefined, nk: nkOf() };
  return { page: rw.sp.page, js: rw.sp.js, je: rw.sp.je, mode: mm.kind + rw.src, note: '', h: Hs[mm.at], src: Hs[rw.at], nk: nkOf() };
});
const stack: number[] = [];
const out: { base: string; kp: string; page: string; js: number; je: number; mode: string; title: string; srcTitle: string; nodeKey: string }[] = [];
const audit: string[] = ['zhu_line\tzhu_kp\tzhu_title\tmode\t1579卷\t1579_kp\t1579標題\t窗源行\t1579窗標題\tpage\tjs\tje\t說明'];
const tally: Record<string, number> = {};
my.forEach((r, i) => {
  while (stack.length && my[stack[stack.length - 1]!]!.d >= r.d) stack.pop();
  let rec = { base: r.base, kp: r.kp, page: ownWin[i]!.page, js: ownWin[i]!.js, je: ownWin[i]!.je, mode: ownWin[i]!.mode, title: r.title.trim(), srcTitle: ownWin[i]!.src?.raw?.trim() ?? (ownWin[i] as any).dlLabel ?? '', nodeKey: (ownWin[i] as any).nk ?? '' };
  let note = ownWin[i]!.note;
  if (rec.js < 0) {
    for (let k = stack.length - 1; k >= 0; k--) {
      const a = ownWin[stack[k]!]!;
      if (a.js >= 0) {
        rec = { base: r.base, kp: r.kp, page: a.page, js: a.js, je: a.je, mode: 'K', title: r.title.trim(), srcTitle: a.src?.raw?.trim() ?? (a as any).dlLabel ?? '', nodeKey: (a as any).nk ?? '' };
        note = `祖先 L${my[stack[k]!]!.line}「${my[stack[k]!]!.title.trim()}」`;
        break;
      }
    }
    if (rec.js < 0) { rec.mode = 'no'; note = '自身與祖先皆無錨'; }
  }
  stack.push(i);
  tally[rec.mode] = (tally[rec.mode] ?? 0) + 1;
  out.push(rec);
  const ow = ownWin[i]!;
  audit.push([r.line, r.kp, r.title, rec.mode, ow.h ? String(ow.h.v) : '', ow.h?.kp ?? '', ow.h?.nt ?? '', ow.src?.line ?? '', ow.src?.raw ?? '', rec.page, rec.js, rec.je, note].join('\t'));
});
fs.writeFileSync(`${SCR}/zhu-spans-${SER}.json`, JSON.stringify(out, null, 0), 'utf8');
fs.writeFileSync(`${SCR}/zhu-spans-${SER}-audit.tsv`, audit.join('\n') + '\n', 'utf8');
console.log(`【${SER}】科判 ${my.length}（${files.length} 卷）｜對齊錨 ${matched.size}（LCS ${lcs.size}）｜D 層現掛 ${my.filter((x) => x.dw).length}（與 LCS 同窗 ${agreeN}、不同窗 ${disagreeN}、AP 被對齊改回 ${apOverrideN}、合理性閘拒 ${dGateN}）｜窗分mode：`,
  Object.entries(tally).map(([k, v]) => `${k}:${v}`).join('  '));
console.log(`→ zhu-spans-${SER}.json / zhu-spans-${SER}-audit.tsv`);
