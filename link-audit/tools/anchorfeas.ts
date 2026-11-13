import fs from 'fs';
import path from 'path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const OUT = 'D:/2026/yogacarabhumi-dila/link-audit/data';
const o = []; const P = (...a) => o.push(a.join(' '));
const nf = n => Number(n).toLocaleString('en-US');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.md'));
const seriesOf = b => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const norm = t => (t || '').replace(/^[A-Za-z甲乙丙丁戊己庚辛壬癸]\s*\d*\s*/, '').replace(/\d+/g, '')
  .replace(/[\s，。、：；（）()【】〔〕《》「」“”‘’?？·]/g, '').slice(0, 24);

// ---- 1. 節點：所有 kpD 錨點定義 ----
const NODE = new Map();   // key -> {file,series,tier,seq,label,line}
const DEFKEY = new Map(); // file -> Set(tier:seq)
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  const set = new Set();
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/);
    if (!m) continue;
    const tier = +m[3], seq = +m[4], key = base + '#kpD' + m[3] + '-' + m[4];
    set.add(tier + ':' + seq);
    if (!NODE.has(key)) NODE.set(key, { file: base, series: seriesOf(base), tier, seq, label: norm(m[2]), raw: m[2], line: i + 1 });
  }
  DEFKEY.set(base, set);
}
// ---- 2. 邊：已解析互鏈（來源上下文科判 → 目標科判）----
const EDGES = [];      // {s,t,label}
let links = 0, resolved = 0, noCtx = 0;
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  let ctx = null;
  for (const ln of lines) {
    const hm = ln.match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/);
    if (hm) ctx = base + '#kpD' + hm[3] + '-' + hm[4];
    for (const m of ln.matchAll(/\[\[([\s\S]*?)\]\](?!\])/g)) {
      const inner = m[1]; const bar = inner.indexOf('|');
      const body = (bar >= 0 ? inner.slice(0, bar) : inner).trim();
      const label = bar >= 0 ? inner.slice(bar + 1).trim() : '';
      const h = body.indexOf('#'); if (h < 0) continue;
      const tf = body.slice(0, h).trim();
      const am = body.slice(h + 1).match(/\^?(kpD\d+-\d+)/); if (!am) continue;
      links++;
      const tm = am[1].match(/^kpD(\d+)-(\d+)$/);
      if (!DEFKEY.get(tf)?.has(+tm[1] + ':' + +tm[2])) continue;
      resolved++;
      const tkey = tf + '#' + am[1];
      if (!ctx || !NODE.has(ctx)) { noCtx++; continue; }
      if (ctx === tkey) continue;
      EDGES.push({ s: ctx, t: tkey, label });
    }
  }
}
P('=== 1. 規模 ===');
P('  kpD 錨點節點 ' + nf(NODE.size) + '（' + DEFKEY.size + ' 檔）');
P('  kpD 互鏈 ' + nf(links) + '，其中目標錨點存在 ' + nf(resolved) + '；可取得來源上下文 ' + nf(EDGES.length) + '（無上下文 ' + nf(noCtx) + '）');
const deg = new Map();
for (const e of EDGES) { deg.set(e.s, (deg.get(e.s) || 0) + 1); deg.set(e.t, (deg.get(e.t) || 0) + 1); }
P('  至少有一條對齐斷言的節點 ' + nf(deg.size) + ' / ' + nf(NODE.size) + ' = ' + (100 * deg.size / NODE.size).toFixed(1) + '%');
P('  完全孤立（无任何跨系列斷言）的節點 ' + nf(NODE.size - deg.size));

// ---- 3. 連通元件 ----
const parent = new Map();
const find = x => { let r = x; while (parent.get(r) !== r) r = parent.get(r); let c = x; while (parent.get(c) !== c) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
for (const k of NODE.keys()) parent.set(k, k);
for (const e of EDGES) { const a = find(e.s), b = find(e.t); if (a !== b) parent.set(a, b); }
const comp = new Map();
for (const k of NODE.keys()) { const r = find(k); if (!comp.has(r)) comp.set(r, []); comp.get(r).push(k); }
const sizes = [...comp.values()].map(c => c.length).sort((a, b) => b - a);
const multi = [...comp.values()].filter(c => new Set(c.map(k => NODE.get(k).series)).size >= 2);
P('\n=== 2. 連通元件（＝跨版本 anchor 候選）===');
P('  元件總數 ' + nf(comp.size) + '；其中跨 ≥2 系列 ' + nf(multi.length) + '（' + (100 * multi.length / comp.size).toFixed(1) + '%）');
P('  元件大小：max ' + sizes[0] + '  p99 ' + sizes[Math.floor(sizes.length * .01)] + '  中位 ' + sizes[sizes.length >> 1] + '  單節點 ' + nf(sizes.filter(s => s === 1).length));
const spanHist = {};
for (const c of comp.values()) { const n = new Set(c.map(k => NODE.get(k).series)).size; spanHist[n] = (spanHist[n] || 0) + 1; }
P('  依「涵蓋系列數」分布: ' + Object.entries(spanHist).sort((a, b) => a[0] - b[0]).map(([k, v]) => k + '系列:' + nf(v)).join('  '));
const covered = multi.reduce((a, c) => a + c.length, 0);
P('  落在跨系列元件內的節點 ' + nf(covered) + ' / ' + nf(NODE.size) + ' = ' + (100 * covered / NODE.size).toFixed(1) + '%  ← 可自動提案的覆蓋上限');

// ---- 4. 元件內標籤一致性 ----
let agree = 0, part = 0, disagree = 0; const tierSpread = [];
for (const c of multi) {
  const labs = new Set(c.map(k => NODE.get(k).label).filter(x => x));
  const tiers = new Set(c.map(k => NODE.get(k).tier));
  tierSpread.push(tiers.size);
  if (labs.size <= 1) agree++; else if (labs.size <= 2) part++; else disagree++;
}
P('\n=== 3. 跨系列元件的語意一致性 ===');
P('  標籤完全一致 ' + nf(agree) + '（' + (100 * agree / multi.length).toFixed(1) + '%）／2 種 ' + nf(part) + '／≥3 種 ' + nf(disagree));
P('  元件內 tier 種類數：中位 ' + tierSpread.sort((a, b) => a - b)[tierSpread.length >> 1] + '  max ' + Math.max(...tierSpread));

// ---- 5. 扇出與衝突 ----
const outMap = new Map(), inMap = new Map();
for (const e of EDGES) {
  const ok = e.s + '|' + NODE.get(e.t).series;
  if (!outMap.has(ok)) outMap.set(ok, new Set()); outMap.get(ok).add(e.t);
  if (!inMap.has(e.t)) inMap.set(e.t, new Set()); inMap.get(e.t).add(e.s);
}
let one2many = 0, many2one = 0;
for (const [, s] of outMap) if (s.size > 1) one2many++;
for (const [, s] of inMap) if (s.size > 1) many2one++;
P('\n=== 4. 粒度錯配（posmap能不能直接用）===');
P('  一個來源錨點 → 同系列多個目標錨點（1:N）: ' + nf(one2many) + ' 組');
P('  一個目標錨點 ← 多個來源錨點（N:1）: ' + nf(many2one) + ' 個');
P('  → 1:N 與 N:1 都存在，代表 posmap 不是雙射，anchor_map 需允许一 anchor 對多 span（v0.3 的 (anchor,edition)→span 唯一來源會衝突）');

// ---- 6. 各系列覆蓋 ----
P('\n=== 5. 各系列：節點數 / 有斷言 / 在跨系列元件內 ===');
const per = {};
for (const [k, n] of NODE) { const s = n.series; (per[s] ??= { n: 0, deg: 0, multi: 0 }); per[s].n++; if (deg.has(k)) per[s].deg++; }
const inMulti = new Set(); for (const c of multi) for (const k of c) inMulti.add(k);
for (const [k, n] of NODE) if (inMulti.has(k)) per[n.series].multi++;
const rows = Object.entries(per).sort((a, b) => b[1].n - a[1].n);
P('  ' + 'series'.padEnd(12) + 'nodes'.padStart(8) + '有斷言'.padStart(9) + '跨系列'.padStart(9) + '  跨系列%');
for (const [s, v] of rows.slice(0, 22)) P('  ' + s.padEnd(12) + nf(v.n).padStart(8) + nf(v.deg).padStart(9) + nf(v.multi).padStart(9) + '  ' + (100 * v.multi / v.n).toFixed(1) + '%');
fs.writeFileSync(path.join(OUT, 'anchor-feasibility.txt'), o.join('\n'), 'utf8');
fs.writeFileSync(path.join(OUT, 'anchor-series-coverage.csv'), 'series,nodes,with_assertion,in_cross_series_component,pct\n' +
  rows.map(([s, v]) => [s, v.n, v.deg, v.multi, (100 * v.multi / v.n).toFixed(2)].join(',')).join('\n'), 'utf8');
console.log(o.join('\n'));
