import fs from 'fs';
import path from 'path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const OUT = ROOT + '/link-audit/data';
const o = []; const P = (...a) => o.push(a.join(' '));
const nf = n => Number(n).toLocaleString('en-US');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.md'));
const seriesOf = b => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const norm = t => (t || '').replace(/^[A-Za-z甲乙丙丁戊己庚辛壬癸]\s*\d*\s*/, '').replace(/\d+/g, '')
  .replace(/[\s，。、：；（）()【】〔〕《》「」“”‘’?？·]/g, '').slice(0, 24);
const NODE = new Map(), DEFKEY = new Map();
for (const f of files) {
  const base = f.replace(/\.md$/, ''); const set = new Set();
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/); if (!m) continue;
    set.add(+m[3] + ':' + +m[4]); const key = base + '#kpD' + m[3] + '-' + m[4];
    if (!NODE.has(key)) NODE.set(key, { file: base, series: seriesOf(base), tier: +m[3], seq: +m[4], label: norm(m[2]), raw: m[2], line: i + 1 }); }
  DEFKEY.set(base, set);
}
const EDGES = [];
for (const f of files) {
  const base = f.replace(/\.md$/, ''); let ctx = null;
  for (const ln of fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')) {
    const hm = ln.match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/); if (hm) ctx = base + '#kpD' + hm[3] + '-' + hm[4];
    for (const m of ln.matchAll(/\[\[([\s\S]*?)\]\](?!\])/g)) {
      const inner = m[1], bar = inner.indexOf('|'), body = (bar >= 0 ? inner.slice(0, bar) : inner).trim();
      const h = body.indexOf('#'); if (h < 0) continue; const tf = body.slice(0, h).trim();
      const am = body.slice(h + 1).match(/\^?(kpD\d+-\d+)/); if (!am) continue;
      const tm = am[1].match(/^kpD(\d+)-(\d+)$/); if (!DEFKEY.get(tf)?.has(+tm[1] + ':' + +tm[2])) continue;
      const tkey = tf + '#' + am[1]; if (!ctx || !NODE.has(ctx) || ctx === tkey) continue;
      EDGES.push({ s: ctx, t: tkey });
    }
  }
}
const parent = new Map(); const find = x => { let r = x; while (parent.get(r) !== r) r = parent.get(r); let c = x; while (parent.get(c) !== c) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
for (const k of NODE.keys()) parent.set(k, k);
for (const e of EDGES) { const a = find(e.s), b = find(e.t); if (a !== b) parent.set(a, b); }
const comp = new Map(); for (const k of NODE.keys()) { const r = find(k); (comp.get(r) ?? comp.set(r, []).get(r)).push(k); }
const multi = [...comp.values()].filter(c => new Set(c.map(k => NODE.get(k).series)).size >= 2);

let flat = 0, flatAgree = 0, hier = 0; const maxPerSeries = []; const flatNodes = [], hierNodes = [];
const flatAgreeNodes = [];
for (const c of multi) {
  const bySer = new Map();
  for (const k of c) { const s = NODE.get(k).series; bySer.set(s, (bySer.get(s) || 0) + 1); }
  const mx = Math.max(...bySer.values()); maxPerSeries.push(mx);
  const labs = new Set(c.map(k => NODE.get(k).label).filter(x => x));
  if (mx === 1) { flat++; flatNodes.push(...c); if (labs.size <= 1) { flatAgree++; flatAgreeNodes.push(...c); } }
  else { hier++; hierNodes.push(...c); }
}
maxPerSeries.sort((a, b) => a - b);
P('=== 決定性指標：每個系列在元件內貢獻幾個節點 ===');
P('  跨系列元件 ' + nf(multi.length));
P('  **扁平**（每系列恰好 1 節點＝真正的等價類）: ' + nf(flat) + '  (' + (100 * flat / multi.length).toFixed(1) + '%)');
P('     其中標籤又全一致: ' + nf(flatAgree) + '  (' + (100 * flatAgree / multi.length).toFixed(1) + '%)  ← 可直接機器提案為 v0.3 anchor');
P('  **階層**（某系列貢獻 >1 節點＝粒度差，需 parent/child 或 refines/splits）: ' + nf(hier) + '  (' + (100 * hier / multi.length).toFixed(1) + '%)');
P('  每系列最大貢獻數：中位 ' + maxPerSeries[maxPerSeries.length >> 1] + '  p95 ' + maxPerSeries[Math.floor(maxPerSeries.length * .95)] + '  max ' + maxPerSeries[maxPerSeries.length - 1]);
P('');
P('  扁平元件涵蓋節點 ' + nf(flatNodes.length) + ' = 全庫錨點 ' + (100 * flatNodes.length / NODE.size).toFixed(1) + '%');
P('  扁平且標籤一致涵蓋節點 ' + nf(flatAgreeNodes.length) + ' = ' + (100 * flatAgreeNodes.length / NODE.size).toFixed(1) + '%  ← 零人工即可提案的規模');
P('  階層元件涵蓋節點 ' + nf(hierNodes.length) + ' = ' + (100 * hierNodes.length / NODE.size).toFixed(1) + '%  ← 需分層處理');
P('  孤立節點（無任何斷言）' + nf(NODE.size - flatNodes.length - hierNodes.length) + ' = ' + (100 * (NODE.size - flatNodes.length - hierNodes.length) / NODE.size).toFixed(1) + '%');

// 扁平且一致元件的系列數分布
const spanHist = {};
for (const c of multi) {
  const bySer = new Map(); for (const k of c) { const s = NODE.get(k).series; bySer.set(s, (bySer.get(s) || 0) + 1); }
  if (Math.max(...bySer.values()) !== 1) continue;
  const labs = new Set(c.map(k => NODE.get(k).label).filter(x => x)); if (labs.size > 1) continue;
  spanHist[bySer.size] = (spanHist[bySer.size] || 0) + 1;
}
P('\n  扁平+一致元件的「涵蓋版本數」分布: ' + Object.entries(spanHist).sort((a, b) => a[0] - b[0]).map(([k, v]) => k + '版:' + nf(v)).join('  '));

// 標籤長度風險：短通用標籤（徵/釋/標/解）可能誤合
const labLen = {};
for (const c of multi) {
  const bySer = new Map(); for (const k of c) { const s = NODE.get(k).series; bySer.set(s, (bySer.get(s) || 0) + 1); }
  if (Math.max(...bySer.values()) !== 1) continue;
  const labs = [...new Set(c.map(k => NODE.get(k).label).filter(x => x))]; if (labs.length !== 1) continue;
  const L = labs[0].length; const b = L <= 2 ? '<=2' : L <= 4 ? '3-4' : L <= 8 ? '5-8' : '>8';
  labLen[b] = (labLen[b] || 0) + 1;
}
P('\n=== 扁平+一致元件的標籤長度（短標籤＝誤合風險）===');
P('  ' + Object.entries(labLen).map(([k, v]) => k + '字:' + nf(v)).join('  '));
const shortN = labLen['<=2'] || 0;
P('  ≤2 字（徵/釋/標/解 一類）占 ' + (100 * shortN / flatAgree).toFixed(1) + '% → 這批不宜零人工，需抽驗');
P('  扣除短標籤後可較放心提案: ' + nf(flatAgree - shortN) + ' 個 anchor');

// 成本估算（用 ys 的 4-6 條/人日基準）
const needHuman = hier + (multi.length - flat - hier) + (flat - flatAgree);
P('\n=== 成本估算（基準：ys 人工對齐 4–6 條/人日）===');
P('  可機器提案（扁平+標籤一致）: ' + nf(flatAgree) + ' 個 anchor，涵蓋 ' + nf(flatAgreeNodes.length) + ' 個版本錨點');
P('  需人工判讀的元件: ' + nf(multi.length - flatAgree) + ' 個 → 約 ' + Math.round((multi.length - flatAgree) / 6) + '–' + Math.round((multi.length - flatAgree) / 4) + ' 人日');
P('  孤立錨點 ' + nf(NODE.size - flatNodes.length - hierNodes.length) + ' 個另需對齐方法（不在互鏈圖內）');
fs.writeFileSync(OUT + '/anchor-feasibility3.txt', o.join('\n'), 'utf8');
console.log(o.join('\n'));
