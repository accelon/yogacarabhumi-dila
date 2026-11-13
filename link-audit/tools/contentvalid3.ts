import fs from 'fs';
import path from 'path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const OUT = ROOT + '/link-audit/data';
const o = []; const P = (...a) => o.push(a.join(' '));
const nf = n => Number(n).toLocaleString('en-US');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.md'));
const seriesOf = b => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const norm = t => (t || '').replace(/^[A-Za-z甲乙丙丁戊己庚辛壬癸]\s*\d*\s*/, '')
  .replace(/[（(][^）)]*[）)]/g, '').replace(/缺/g, '').replace(/\d+/g, '')
  .replace(/[\s，。、：；【】〔〕《》「」“”‘’?？·]/g, '').slice(0, 24);

// 依 DILA 權威略符表：work（同一部著作）与 role（本論/釋論）
const WORK = {
  T1605: ['集論', 'root'], ASsP: ['集論', 'root'], ASsG: ['集論', 'root'], CT3278: ['集論', 'root'],
  T1606: ['集論釋', 'comm'], ASBhT: ['集論釋', 'comm'], CT3282: ['集論釋', 'comm'], CT3283: ['集論釋', 'comm'],
  CT3252: ['莊嚴頌', 'root'], MSAL: ['莊嚴頌', 'root'], T1604: ['莊嚴頌', 'root'],
  CT3258: ['莊嚴釋', 'comm'], CT3261: ['莊嚴釋', 'comm'], CT3263: ['莊嚴釋', 'comm'], CT3266: ['莊嚴釋', 'comm'],
  T1579: ['瑜伽論', 'root'], CT3267: ['瑜伽論', 'root'], CT3268: ['瑜伽論', 'root'], CT3269: ['瑜伽論', 'root'],
  CT3270: ['瑜伽論', 'root'], CT3271: ['瑜伽論', 'root'],
  YoBA: ['瑜伽論', 'root'], YoBB: ['瑜伽論', 'root'], YoBC: ['瑜伽論', 'root'], YoTG: ['瑜伽論', 'root'],
  YoTJ: ['瑜伽論', 'root'], YoTK: ['瑜伽論', 'root'], YoEK: ['瑜伽論', 'root'], YoSH: ['瑜伽論', 'root'],
  ShSH: ['瑜伽論', 'root'], ShSS: ['瑜伽論', 'root'], ShST: ['瑜伽論', 'root'], ShTS: ['瑜伽論', 'root'],
  BoSW: ['瑜伽論', 'root'], BoSD: ['瑜伽論', 'root'], H4037: ['瑜伽論', 'root'], D4039: ['瑜伽論', 'root'],
  T1580: ['瑜伽論釋', 'comm'], T1828: ['瑜伽論釋', 'comm'], T1829: ['瑜伽論釋', 'comm'],
  T2801: ['瑜伽論釋', 'comm'], T2802: ['瑜伽論釋', 'comm'], T2259: ['瑜伽論釋', 'comm'], PXJH: ['瑜伽論釋', 'comm'],
  T1581: ['菩薩地漢譯', 'root'], T1583: ['菩薩地漢譯', 'root'], T1582: ['菩薩地漢譯', 'root'],
  T1584: ['決定藏論', 'root'], T1602: ['顯揚聖教論', 'root'], T0099: ['雜阿含', 'root'], X0794: ['劫章頌', 'root'],
};
const workOf = s => WORK[s.replace(/-/g, '')] || [s, '?'];
// 語言依 DILA 權威略符表（CT*/Sh-TS/H4037/D4039＝藏；AS/Yo/Sh-S*/Bo/MSA＝梵；T*/PXJ/X＝漢）
const LANG = s => {
  const k = s.replace(/-/g, '');
  if (/^CT/.test(k) || k === 'ShTS' || k === 'H4037' || k === 'D4039') return 'bo';
  if (/^(AS|Yo|Bo|MSA)/.test(k) || ['ShSH','ShSS','ShST'].includes(k)) return 'sa';
  return 'zh';
};

const NODE = new Map(), DEFKEY = new Map(), BODY = new Map();
// 徹底剝除：wikilink、註腳、錨點、HTML、方括號校勘（含內容）、§ 節號、羅馬數字括號、所有數字
const clean = s => s.replace(/\[\[[\s\S]*?\]\](?!\])/g, '').replace(/\[\^[^\]]+\]:?/g, '')
  .replace(/\[[^\]]*\]/g, '').replace(/§\s*\d+\s*\.?/g, '').replace(/\([ivxIVX]+\)/g, '')
  .replace(/\^kpD[\d\-]+/g, '').replace(/<[^>]*>/g, '').replace(/[0-9]/g, '');
for (const f of files) {
  const base = f.replace(/\.md$/, ''); const set = new Set();
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  const heads = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/); if (!m) continue;
    set.add(+m[3] + ':' + +m[4]); const key = base + '#kpD' + m[3] + '-' + m[4];
    if (!NODE.has(key)) NODE.set(key, { file: base, series: seriesOf(base), tier: +m[3], seq: +m[4], label: norm(m[2]), raw: m[2], line: i + 1 });
    heads.push({ key, i });
  }
  DEFKEY.set(base, set);
  for (let h = 0; h < heads.length; h++) {
    const s = heads[h].i + 1, e = h + 1 < heads.length ? heads[h + 1].i : lines.length;
    const buf = [];
    for (let i = s; i < e; i++) { const t = clean(lines[i]).trim(); if (t && !/^《?\s*》?$/.test(t)) buf.push(t); }
    BODY.set(heads[h].key, buf.join('').slice(0, 600));
  }
}
const GOOD = [];
for (const f of files) {
  const base = f.replace(/\.md$/, ''); let ctx = null;
  for (const ln of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
    const hm = ln.match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/); if (hm) ctx = base + '#kpD' + hm[3] + '-' + hm[4];
    for (const m of ln.matchAll(/\[\[([\s\S]*?)\]\](?!\])/g)) {
      const inner = m[1], bar = inner.indexOf('|'), body = (bar >= 0 ? inner.slice(0, bar) : inner).trim();
      const h = body.indexOf('#'); if (h < 0) continue; const tf = body.slice(0, h).trim();
      const am = body.slice(h + 1).match(/\^?(kpD\d+-\d+)/); if (!am) continue;
      const tm = am[1].match(/^kpD(\d+)-(\d+)$/); if (!DEFKEY.get(tf)?.has(+tm[1] + ':' + +tm[2])) continue;
      const tk = tf + '#' + am[1]; if (!ctx || !NODE.has(ctx) || ctx === tk) continue;
      const s = NODE.get(ctx), t = NODE.get(tk);
      if (s.label && s.label === t.label) GOOD.push([ctx, tk]);
    }
  }
}
const p = new Map(); const find = x => { let r = x; while (p.get(r) !== r) r = p.get(r); let c = x; while (p.get(c) !== c) { const n = p.get(c); p.set(c, r); c = n; } return r; };
for (const k of NODE.keys()) p.set(k, k);
for (const [a, b] of GOOD) { const x = find(a), y = find(b); if (x !== y) p.set(x, y); }
const comp = new Map(); for (const k of NODE.keys()) { const r = find(k); (comp.get(r) ?? comp.set(r, []).get(r)).push(k); }
const SAFE = [];
for (const c of comp.values()) {
  const bySer = new Map(); for (const k of c) { const s = NODE.get(k).series; bySer.set(s, (bySer.get(s) || 0) + 1); }
  if (bySer.size < 2 || Math.max(...bySer.values()) !== 1) continue;
  const labs = [...new Set(c.map(k => NODE.get(k).label).filter(x => x))];
  if (labs.length !== 1 || labs[0].length <= 2) continue;
  SAFE.push(c);
}
function scriptOf(t) {
  if (!t) return 'empty';
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length, tib = (t.match(/[\u0f00-\u0fff]/g) || []).length, lat = (t.match(/[A-Za-z]/g) || []).length;
  const tot = cjk + tib + lat; if (!tot) return 'empty';
  if (tib / tot > .5) return 'bo'; if (cjk / tot > .5) return 'zh'; if (lat / tot > .5) return 'sa'; return 'mix';
}
const stripFor = (lang, t) => lang === 'zh' ? t.replace(/[^一-鿿]/g, '')
  : lang === 'bo' ? t.replace(/[^ༀ-࿿]/g, '')
  : t.replace(/[^A-Za-z]/g, '');
function dice(a, b) {
  if (!a || !b) return 0; if (a === b) return 1;
  const g = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.substr(i, 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = g(a), B = g(b); let inter = 0, na = 0, nb = 0;
  for (const [, v] of A) na += v; for (const [, v] of B) nb += v;
  for (const [k, v] of A) { const w = B.get(k); if (w) inter += Math.min(v, w); }
  return na + nb ? 2 * inter / (na + nb) : 0;
}
let noText = 0, noPair = 0, multi = 0, exactAll = 0, highAll = 0, midAll = 0, lowAll = 0;
const sims = []; const byWork = new Map(); const rows = []; const exLow = [];
for (const c of SAFE) {
  const ms = c.map(k => { const n = NODE.get(k); const b = BODY.get(k) || ''; const [w, r] = workOf(n.series);
    const lg = LANG(n.series); return { k, n, body: b, sc: lg, w, r, cmp: stripFor(lg, b) }; });
  const usable = ms.filter(m => m.cmp.length >= 8);
  if (usable.length < 2) { noText++; continue; }
  // 只比「同 work + 同 role + 同語言」
  const groups = new Map();
  for (const m of usable) { const key = m.w + '|' + m.r + '|' + m.sc; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(m); }
  const gs = [...groups.entries()].filter(([, g]) => g.length >= 2);
  if (!gs.length) { noPair++; continue; }
  multi++;
  let allExact = true, allHigh = true, anyLow = false; const ps = [];
  for (const [gk, g] of gs) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = g[i].cmp, b = g[j].cmp; const s = dice(a, b); ps.push(s); sims.push(s);
    if (a !== b) allExact = false; if (s < 0.90) allHigh = false; if (s < 0.50) anyLow = true;
    const w = byWork.get(gk) ?? { n: 0, sum: 0, exact: 0, low: 0 }; w.n++; w.sum += s; if (a === b) w.exact++; if (s < .5) w.low++; byWork.set(gk, w);
  }
  const mean = ps.reduce((x, y) => x + y, 0) / ps.length;
  const v = allExact ? 'exact' : allHigh ? 'high' : anyLow ? 'low' : 'mid';
  if (allExact) exactAll++; else if (allHigh) highAll++; else if (anyLow) { lowAll++; if (exLow.length < 5) exLow.push({ g: gs[0][1], mean, gk: gs[0][0] }); } else midAll++;
  rows.push([c.length, v, mean.toFixed(3), gs.map(([k, g]) => k + 'x' + g.length).join('|')].join(','));
}
sims.sort((a, b) => a - b);
const q = x => sims.length ? sims[Math.floor(sims.length * x)].toFixed(3) : '-';
P('=== 內容級驗證 v3（語言依權威表判定 + 只取該語言字元 + 同本同role）===');
P('  安全元件 ' + nf(SAFE.length));
P('  無正文/過短 ' + nf(noText) + '；有正文但無「同本同語言」配對 ' + nf(noPair) + '；**可比 ' + nf(multi) + '**');
P('');
P('  可比元件中：逐字相同 ' + nf(exactAll) + ' (' + (100 * exactAll / multi).toFixed(1) + '%)');
P('              Dice>=0.90 ' + nf(highAll) + ' (' + (100 * highAll / multi).toFixed(1) + '%)');
P('              0.50–0.90 ' + nf(midAll) + ' (' + (100 * midAll / multi).toFixed(1) + '%)');
P('              <0.50     ' + nf(lowAll) + ' (' + (100 * lowAll / multi).toFixed(1) + '%)');
P('  配對相似度 p10 ' + q(.1) + ' 中位 ' + q(.5) + ' p90 ' + q(.9) + '（' + nf(sims.length) + ' 對）');
P('\n=== 按「著作|role|語言」分組 ===');
P('  ' + 'group'.padEnd(26) + 'pairs'.padStart(7) + 'meanDice'.padStart(10) + 'exact'.padStart(7) + 'low'.padStart(6));
for (const [k, v] of [...byWork.entries()].sort((a, b) => b[1].n - a[1].n))
  P('  ' + k.padEnd(26) + nf(v.n).padStart(7) + (v.sum / v.n).toFixed(3).padStart(10) + nf(v.exact).padStart(7) + nf(v.low).padStart(6));
if (exLow.length) { P('\n  --- 仍低相似例 ---'); for (const x of exLow) { P('    ' + x.gk + ' 平均 ' + x.mean.toFixed(3)); for (const m of x.g.slice(0, 3)) P('      ' + m.k + ' [' + m.sc + '] 「' + m.n.raw.slice(0, 18) + '」 ' + m.cmp.slice(0, 44)); } }
fs.writeFileSync(OUT + '/anchor-content-validation3.txt', o.join('\n'), 'utf8');
fs.writeFileSync(OUT + '/anchor-content-verdicts3.csv', 'members,verdict,mean_dice,groups\n' + rows.join('\n'), 'utf8');
console.log(o.join('\n'));
