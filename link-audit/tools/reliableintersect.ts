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

const NODE = new Map(), DEFKEY = new Map(), byFileLabel = new Map();
for (const f of files) {
  const base = f.replace(/\.md$/, ''); const set = new Set(); const m2 = new Map();
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) { const m = lines[i].match(/^(#{1,6})\s+(.*?)\s+\^kpD(\d+)-(\d+)\s*$/); if (!m) continue;
    set.add(+m[3] + ':' + +m[4]); const key = base + '#kpD' + m[3] + '-' + m[4]; const lb = norm(m[2]);
    NODE.set(key, { file: base, series: seriesOf(base), tier: +m[3], seq: +m[4], label: lb, raw: m[2], line: i + 1 });
    if (lb) { if (!m2.has(lb)) m2.set(lb, []); m2.get(lb).push(key); } }
  DEFKEY.set(base, set); byFileLabel.set(base, m2);
}
// GOOD 邊：兩端標籤一致
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
// 安全元件：跨>=2系列 + 每系列恰好1節點 + 標籤唯一且>2字
const SAFE = new Map();
for (const [r, c] of comp) {
  const bySer = new Map(); for (const k of c) { const s = NODE.get(k).series; bySer.set(s, (bySer.get(s) || 0) + 1); }
  if (bySer.size < 2 || Math.max(...bySer.values()) !== 1) continue;
  const labs = [...new Set(c.map(k => NODE.get(k).label).filter(x => x))];
  if (labs.length !== 1 || labs[0].length <= 2) continue;
  SAFE.set(r, c);
}
const safeNode = new Set(); for (const c of SAFE.values()) for (const k of c) safeNode.add(k);
P('=== 基準 ===');
P('  GOOD 邊 ' + nf(GOOD.length) + '；安全元件 ' + nf(SAFE.size) + '；安全節點 ' + nf(safeNode.size));

// 讀 auto-fixable，挑出「來源端標題唯一」的可靠子集
const csv = t => { const R = []; let c = [], q = false, s = '';
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (ch === '"') { if (q && t[i + 1] === '"') { s += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { c.push(s); s = ''; }
    else if ((ch === '\n' || ch === '\r') && !q) { if (s !== '' || c.length) { c.push(s); R.push(c); c = []; s = ''; } }
    else s += ch; }
  if (s !== '' || c.length) { c.push(s); R.push(c); } return R; };
const rows = csv(fs.readFileSync(OUT + '/auto-fixable.csv', 'utf8')); const H = rows[0]; const ix = k => H.indexOf(k);
const reliable = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]; const sf = r[ix('source_file')], ca = r[ix('ctx_anchor')], tf = r[ix('target_file')], sa = r[ix('suggested_anchor')];
  const sk = sf + '#' + ca, tk = tf + '#' + sa; const s = NODE.get(sk), t = NODE.get(tk);
  if (!s || !t || !s.label) continue;
  if ((byFileLabel.get(sf)?.get(s.label) || []).length !== 1) continue;   // 來源端唯一
  if ((byFileLabel.get(tf)?.get(t.label) || []).length !== 1) continue;   // 目標端唯一（原已驗，再確認）
  reliable.push({ sf, line: r[ix('line')], ca, tf, sa, sk, tk, s, t });
}
P('  可靠 AUTO（來源端＋目標端標題都唯一）: ' + nf(reliable.length));

// 交集分類
let bothSafeSame = 0, bothSafeDiff = 0, sameNotSafe = 0, oneSafe = 0, noneSafe = 0, isolated = 0;
const ex = { conv: [], conflict: [], notsafe: [], outside: [] };
const byPair = new Map();
for (const r of reliable) {
  const rs = find(r.sk), rt = find(r.tk);
  const sSafe = safeNode.has(r.sk), tSafe = safeNode.has(r.tk);
  const pk = r.s.series + '>' + r.t.series;
  const e = byPair.get(pk) ?? { n: 0, conv: 0 }; e.n++; byPair.set(pk, e);
  if (rs === rt) {
    if (sSafe && tSafe) { bothSafeSame++; e.conv++; if (ex.conv.length < 5) ex.conv.push(r); }
    else { sameNotSafe++; if (ex.notsafe.length < 5) ex.notsafe.push(r); }
  } else if (sSafe && tSafe) { bothSafeDiff++; if (ex.conflict.length < 6) ex.conflict.push(r); }
  else if (sSafe || tSafe) { oneSafe++; if (ex.outside.length < 4) ex.outside.push(r); }
  else noneSafe++;
}
P('\n=== 536 可靠 AUTO × 9,124 安全 anchor 的交集 ===');
P('  **收斂**：兩端在同一個安全元件內 ' + nf(bothSafeSame) + '  (' + (100 * bothSafeSame / reliable.length).toFixed(1) + '%)');
P('  同元件但該元件不在安全集（短標籤/階層/單系列） ' + nf(sameNotSafe));
P('  **衝突**：兩端各自在不同安全元件 ' + nf(bothSafeDiff));
P('  只有一端在安全集 ' + nf(oneSafe));
P('  兩端都不在安全集 ' + nf(noneSafe));
P('\n=== 按系列對（可靠 AUTO）===');
for (const [k, v] of [...byPair.entries()].sort((a, b) => b[1].n - a[1].n)) P('  ' + k.padEnd(22) + nf(v.n).padStart(5) + ' 條，收斂 ' + nf(v.conv).padStart(4) + '  (' + (100 * v.conv / v.n).toFixed(0) + '%)');
function dump(tag, arr) {
  if (!arr.length) return; P('\n  --- ' + tag + ' ---');
  for (const r of arr) {
    P('    ' + r.sf + ':' + r.line + ' 「' + r.s.raw.slice(0, 24) + '」 ' + r.ca + ' → ' + r.tf + ' 「' + r.t.raw.slice(0, 24) + '」 ' + r.sa);
    const cs = comp.get(find(r.sk)), ct = comp.get(find(r.tk));
    P('      來源元件(' + cs.length + '): ' + cs.slice(0, 5).map(k => k.replace('-1#', '#')).join(', '));
    P('      目標元件(' + ct.length + '): ' + ct.slice(0, 5).map(k => k.replace('-1#', '#')).join(', '));
  }
}
dump('收斂例', ex.conv); dump('衝突例', ex.conflict); dump('同元件但非安全集', ex.notsafe); dump('只有一端在安全集', ex.outside);
fs.writeFileSync(OUT + '/anchor-reliable-intersect.txt', o.join('\n'), 'utf8');
fs.writeFileSync(OUT + '/anchor-reliable-auto.csv', 'source_file,line,ctx_anchor,target_file,suggested_anchor,src_label,tgt_label,verdict\n' +
  reliable.map(r => { const rs = find(r.sk), rt = find(r.tk); const v = rs === rt ? (safeNode.has(r.sk) && safeNode.has(r.tk) ? 'converged' : 'same_comp_not_safe') : (safeNode.has(r.sk) && safeNode.has(r.tk) ? 'conflict' : 'partial');
    return [r.sf, r.line, r.ca, r.tf, r.sa, r.s.label, r.t.label, v].join(','); }).join('\n'), 'utf8');
console.log(o.join('\n'));
