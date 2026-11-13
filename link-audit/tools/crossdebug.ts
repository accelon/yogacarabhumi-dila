import fs from 'fs';
import path from 'path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const OUT = ROOT + '/link-audit/data';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.md'));
const seriesOf = b => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const norm = t => (t || '').replace(/^[A-Za-z甲乙丙丁戊己庚辛壬癸]\s*\d*\s*/, '')
  .replace(/[（(][^）)]*[）)]/g, '').replace(/缺/g, '').replace(/\d+/g, '')
  .replace(/[\s，。、：；【】〔〕《》「」“”‘’?？·]/g, '').slice(0, 24);
const NODE = new Map(), DEFKEY = new Map();
for (const f of files) {
  const base = f.replace(/\.md$/, ''); const set = new Set();
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/); if (!m) continue;
    set.add(+m[3] + ':' + +m[4]); const key = base + '#kpD' + m[3] + '-' + m[4];
    if (!NODE.has(key)) NODE.set(key, { file: base, series: seriesOf(base), tier: +m[3], seq: +m[4], label: norm(m[2]), raw: m[2], line: i + 1 }); }
  DEFKEY.set(base, set);
}
const GOOD = [], ALL = [];
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
      ALL.push([ctx, tk]);
      const s = NODE.get(ctx), t = NODE.get(tk);
      if (s.label.length > 0 && s.label === t.label) GOOD.push([ctx, tk]);
    }
  }
}
function build(edges) {
  const p = new Map(); const find = x => { let r = x; while (p.get(r) !== r) r = p.get(r); let c = x; while (p.get(c) !== c) { const n = p.get(c); p.set(c, r); c = n; } return r; };
  for (const k of NODE.keys()) p.set(k, k);
  for (const [a, b] of edges) { const x = find(a), y = find(b); if (x !== y) p.set(x, y); }
  const comp = new Map(); for (const k of NODE.keys()) { const r = find(k); (comp.get(r) ?? comp.set(r, []).get(r)).push(k); }
  return { find, comp };
}
const G = build(GOOD), A = build(ALL);
const csv = t => { const R = []; let c = [], q = false, s = '';
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (ch === '"') { if (q && t[i + 1] === '"') { s += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { c.push(s); s = ''; }
    else if ((ch === '\n' || ch === '\r') && !q) { if (s !== '' || c.length) { c.push(s); R.push(c); c = []; s = ''; } }
    else s += ch; }
  if (s !== '' || c.length) { c.push(s); R.push(c); } return R; };
const rows = csv(fs.readFileSync(OUT + '/auto-fixable.csv', 'utf8')); const H = rows[0]; const ix = k => H.indexOf(k);
const o = [];
o.push('=== 逐案解剖：B 建議的兩端在圖中的狀態 ===');
let shown = 0;
for (let i = 1; i < rows.length && shown < 4; i++) {
  const r = rows[i];
  const sk = r[ix('source_file')] + '#' + r[ix('ctx_anchor')], tk = r[ix('target_file')] + '#' + r[ix('suggested_anchor')];
  if (!NODE.has(sk) || !NODE.has(tk)) continue;
  shown++;
  const s = NODE.get(sk), t = NODE.get(tk);
  o.push('');
  o.push('案例 ' + shown + '  B: ' + sk + ' → ' + tk);
  o.push('  來源標籤「' + s.raw + '」  目標標籤「' + t.raw + '」  正規化後相同? ' + (s.label === t.label));
  o.push('  GOOD 圖: 同元件? ' + (G.find(sk) === G.find(tk)) + '  來源元件大小 ' + G.comp.get(G.find(sk)).length + '  目標元件大小 ' + G.comp.get(G.find(tk)).length);
  o.push('  ALL  圖: 同元件? ' + (A.find(sk) === A.find(tk)));
  o.push('  來源在 GOOD 圖的元件成員（前 6）:');
  for (const k of G.comp.get(G.find(sk)).slice(0, 6)) { const n = NODE.get(k); o.push('    ' + k + '  「' + n.raw.slice(0, 26) + '」'); }
  o.push('  目標在 GOOD 圖的元件成員（前 6）:');
  for (const k of G.comp.get(G.find(tk)).slice(0, 6)) { const n = NODE.get(k); o.push('    ' + k + '  「' + n.raw.slice(0, 26) + '」'); }
  const direct = ALL.filter(([a, b]) => (a === sk && b === tk) || (a === tk && b === sk));
  o.push('  兩端之間有直接邊（ALL）? ' + direct.length);
}
fs.writeFileSync(OUT + '/anchor-crosscheck-debug.txt', o.join('\n'), 'utf8');
console.log(o.join('\n'));
