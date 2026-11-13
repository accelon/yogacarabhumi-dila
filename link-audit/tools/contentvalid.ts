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

// ---- 節點 + 正文範圍 ----
const NODE = new Map(), DEFKEY = new Map();
const BODY = new Map();   // key -> 正文（已剝連結/註腳/標記）
const clean = s => s.replace(/\[\[[\s\S]*?\]\](?!\])/g, '').replace(/\[\^[^\]]+\]:?/g, '')
  .replace(/\^kpD[\d\-]+/g, '').replace(/<[^>]*>/g, '').replace(/《\s*》/g, '');
for (const f of files) {
  const base = f.replace(/\.md$/, ''); const set = new Set();
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  const heads = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/);
    if (!m) continue;
    set.add(+m[3] + ':' + +m[4]);
    const key = base + '#kpD' + m[3] + '-' + m[4];
    if (!NODE.has(key)) NODE.set(key, { file: base, series: seriesOf(base), tier: +m[3], seq: +m[4], label: norm(m[2]), raw: m[2], line: i + 1 });
    heads.push({ key, i });
  }
  DEFKEY.set(base, set);
  for (let h = 0; h < heads.length; h++) {
    const s = heads[h].i + 1, e = h + 1 < heads.length ? heads[h + 1].i : lines.length;
    let buf = [];
    for (let i = s; i < e; i++) {
      const t = clean(lines[i]).trim();
      if (!t) continue;
      if (/^《?\s*》?$/.test(t)) continue;
      buf.push(t);
    }
    BODY.set(heads[h].key, buf.join('').slice(0, 600));
  }
}
// ---- GOOD 邊 ----
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
P('=== 基準 ===');
P('  安全元件 ' + nf(SAFE.length) + '，成員節點 ' + nf(SAFE.reduce((a, c) => a + c.length, 0)));

// ---- 語言判定 ----
function scriptOf(t) {
  if (!t) return 'empty';
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const tib = (t.match(/[\u0f00-\u0fff]/g) || []).length;
  const lat = (t.match(/[A-Za-z]/g) || []).length;
  const tot = cjk + tib + lat;
  if (!tot) return 'empty';
  if (tib / tot > .5) return 'bo';
  if (cjk / tot > .5) return 'zh';
  if (lat / tot > .5) return 'sa';
  return 'mix';
}
const strip = t => t.replace(/[^\u4e00-\u9fff\u0f00-\u0fffA-Za-z]/g, '');
function dice(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const g = s => { const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const k = s.substr(i, 2); m.set(k, (m.get(k) || 0) + 1); } return m; };
  const A = g(a), B = g(b); let inter = 0, na = 0, nb = 0;
  for (const [, v] of A) na += v; for (const [, v] of B) nb += v;
  for (const [k, v] of A) { const w = B.get(k); if (w) inter += Math.min(v, w); }
  return na + nb ? 2 * inter / (na + nb) : 0;
}
// ---- 逐元件驗證 ----
let noText = 0, singleScript = 0, multi = 0;
let exactAll = 0, highAll = 0, mixedVerdict = 0, lowAll = 0;
const sims = []; const rows = []; const exLow = [], exExact = [];
for (const c of SAFE) {
  const members = c.map(k => ({ k, n: NODE.get(k), body: BODY.get(k) || '', sc: scriptOf(BODY.get(k) || '') }));
  const usable = members.filter(m => m.sc !== 'empty' && m.body.length >= 8);
  if (usable.length < 2) { noText++; rows.push([c.length, 'no_text', '', usable.length].join(',')); continue; }
  const bySc = new Map(); for (const m of usable) { if (!bySc.has(m.sc)) bySc.set(m.sc, []); bySc.get(m.sc).push(m); }
  const groups = [...bySc.values()].filter(g => g.length >= 2);
  if (!groups.length) { singleScript++; rows.push([c.length, 'no_same_script_pair', [...bySc.keys()].join('|'), usable.length].join(',')); continue; }
  multi++;
  let allExact = true, allHigh = true, anyLow = false; const pairSims = [];
  for (const g of groups) for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
    const a = strip(g[i].body), b = strip(g[j].body); const s = dice(a, b);
    pairSims.push(s); sims.push(s);
    if (a !== b) allExact = false;
    if (s < 0.90) allHigh = false;
    if (s < 0.50) anyLow = true;
  }
  const mean = pairSims.reduce((x, y) => x + y, 0) / pairSims.length;
  const verdict = allExact ? 'exact' : allHigh ? 'high' : anyLow ? 'low' : 'mid';
  if (allExact) { exactAll++; if (exExact.length < 3) exExact.push({ c, g: groups[0], mean }); }
  else if (allHigh) highAll++;
  else if (anyLow) { lowAll++; if (exLow.length < 5) exLow.push({ c, g: groups[0], mean }); }
  else mixedVerdict++;
  rows.push([c.length, verdict, mean.toFixed(3), usable.length, groups.map(g => g[0].sc + 'x' + g.length).join('|')].join(','));
}
sims.sort((a, b) => a - b);
const q = x => sims.length ? sims[Math.floor(sims.length * x)].toFixed(3) : '-';
P('\n=== 內容級驗證結果（' + nf(SAFE.length) + ' 個安全元件）===');
P('  可比（有 >=2 個同語言且有正文的成員）: ' + nf(multi));
P('  無正文或正文過短: ' + nf(noText));
P('  有正文但無同語言配對（跨漢/藏/梵）: ' + nf(singleScript));
P('');
P('  在可比的 ' + nf(multi) + ' 個元件中：');
P('    全部配對**逐字相同**: ' + nf(exactAll) + '  (' + (100 * exactAll / multi).toFixed(1) + '%)');
P('    全部配對 Dice >= 0.90: ' + nf(highAll) + '  (' + (100 * highAll / multi).toFixed(1) + '%)');
P('    中等（0.50–0.90）: ' + nf(mixedVerdict) + '  (' + (100 * mixedVerdict / multi).toFixed(1) + '%)');
P('    **有配對 < 0.50（疑似錯接）**: ' + nf(lowAll) + '  (' + (100 * lowAll / multi).toFixed(1) + '%)');
P('');
P('  全部配對相似度分布：p10 ' + q(.1) + '  中位 ' + q(.5) + '  p90 ' + q(.9) + '  （共 ' + nf(sims.length) + ' 對）');
function dump(tag, arr) {
  if (!arr.length) return; P('\n  --- ' + tag + ' ---');
  for (const x of arr) {
    P('    元件 ' + x.c.length + ' 節點，平均 Dice ' + x.mean.toFixed(3));
    for (const m of x.g.slice(0, 3)) P('      ' + m.k + ' [' + m.sc + '] 「' + m.n.raw.slice(0, 20) + '」 正文前 40: ' + m.body.slice(0, 40));
  }
}
dump('逐字相同例', exExact); dump('低相似度例（疑似錯接）', exLow);
fs.writeFileSync(OUT + '/anchor-content-validation.txt', o.join('\n'), 'utf8');
fs.writeFileSync(OUT + '/anchor-content-verdicts.csv', 'members,verdict,mean_dice,usable,script_groups\n' + rows.join('\n'), 'utf8');
console.log(o.join('\n'));
