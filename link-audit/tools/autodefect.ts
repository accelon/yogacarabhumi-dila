import fs from 'fs';
import path from 'path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const OUT = ROOT + '/link-audit/data';
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.md'));
const norm = t => (t || '').replace(/^[A-Za-z甲乙丙丁戊己庚辛壬癸]\s*\d*\s*/, '')
  .replace(/[（(][^）)]*[）)]/g, '').replace(/缺/g, '').replace(/\d+/g, '')
  .replace(/[\s，。、：；【】〔〕《》「」“”‘’?？·]/g, '').slice(0, 24);
// 每檔的 label -> [keys]
const byFileLabel = new Map(); const NODE = new Map(); const DEFKEY = new Map();
for (const f of files) {
  const base = f.replace(/\.md$/, ''); const set = new Set(); const m2 = new Map();
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/); if (!m) continue;
    set.add(+m[3] + ':' + +m[4]); const key = base + '#kpD' + m[3] + '-' + m[4]; const lb = norm(m[2]);
    NODE.set(key, { file: base, label: lb, raw: m[2], tier: +m[3], seq: +m[4], line: i + 1 });
    if (lb) { if (!m2.has(lb)) m2.set(lb, []); m2.get(lb).push(key); } }
  DEFKEY.set(base, set); byFileLabel.set(base, m2);
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

const csv = t => { const R = []; let c = [], q = false, s = '';
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (ch === '"') { if (q && t[i + 1] === '"') { s += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { c.push(s); s = ''; }
    else if ((ch === '\n' || ch === '\r') && !q) { if (s !== '' || c.length) { c.push(s); R.push(c); c = []; s = ''; } }
    else s += ch; }
  if (s !== '' || c.length) { c.push(s); R.push(c); } return R; };
const rows = csv(fs.readFileSync(OUT + '/auto-fixable.csv', 'utf8')); const H = rows[0]; const ix = k => H.indexOf(k);
const o = []; const P = (...a) => o.push(a.join(' '));
const nf = n => Number(n).toLocaleString('en-US');
let srcDup = 0, srcUniq = 0, graphAlt = 0, graphSame = 0, tgtNotInSrcComp = 0;
const dupEx = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]; const sf = r[ix('source_file')], ca = r[ix('ctx_anchor')], tf = r[ix('target_file')], sa = r[ix('suggested_anchor')];
  const sk = sf + '#' + ca, tk = tf + '#' + sa;
  const s = NODE.get(sk), t = NODE.get(tk); if (!s || !t) continue;
  const sameLabelInSrc = (byFileLabel.get(sf)?.get(s.label) || []).length;
  if (sameLabelInSrc > 1) { srcDup++; if (dupEx.length < 6) dupEx.push('    ' + sf + ' 有 ' + sameLabelInSrc + ' 個「' + s.label + '」：' + (byFileLabel.get(sf).get(s.label)).map(k => k.split('#')[1]).join(', ') + '  B 選了 ' + ca + ' → ' + tf + '#' + sa); }
  else srcUniq++;
  const cs = comp.get(find(sk)), ct = comp.get(find(tk));
  if (find(sk) === find(tk)) graphSame++;
  else if (ct.some(k => NODE.get(k).file === sf && NODE.get(k).label === s.label)) graphAlt++;
}
P('=== AUTO 3,902 條的缺陷率（來源端標題是否唯一）===');
P('  來源檔內同標題錨點 >1 個（**B 法可能接錯 occurrence**）: ' + nf(srcDup) + ' = ' + (100 * srcDup / (srcDup + srcUniq)).toFixed(1) + '%');
P('  來源端標題唯一（B 法較可靠）: ' + nf(srcUniq) + ' = ' + (100 * srcUniq / (srcDup + srcUniq)).toFixed(1) + '%');
P('');
P('=== 与 GOOD 圖的關係 ===');
P('  B 的兩端已在同一元件: ' + nf(graphSame));
P('  不同元件，但目標元件內含「來源檔同標題」的另一個錨點（＝圖認為應對到那個）: ' + nf(graphAlt));
P('  → 這 ' + nf(graphAlt) + ' 條是兩法真正的衝突，需人工判');
P('');
P('  來源端重複標題實例:');
for (const e of dupEx) P(e);
fs.writeFileSync(OUT + '/anchor-auto-defect.txt', o.join('\n'), 'utf8');
console.log(o.join('\n'));
