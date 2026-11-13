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
let n = 0, labSame = 0, tierSame = 0, seqSame = 0, bothSame = 0, labEmpty = 0;
const byPair = new Map(); const ex = [];
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
      const s = NODE.get(ctx), t = NODE.get(tk); n++;
      const ls = s.label === t.label && s.label.length > 0;
      if (!s.label || !t.label) labEmpty++;
      if (ls) labSame++;
      if (s.tier === t.tier) tierSame++;
      if (s.seq === t.seq) seqSame++;
      if (s.tier === t.tier && s.seq === t.seq) bothSame++;
      const pk = s.series + '>' + t.series;
      const e = byPair.get(pk) ?? { n: 0, lab: 0 }; e.n++; if (ls) e.lab++; byPair.set(pk, e);
      if (!ls && ex.length < 10) ex.push('    ' + s.file + ':' + s.line + ' 「' + s.raw.slice(0, 22) + '」 → ' + t.file + ':' + t.line + ' 「' + t.raw.slice(0, 22) + '」');
    }
  }
}
P('=== 已解析互鏈的語意品質（這決定它能不能當 posmap）===');
P('  可比邊數 ' + nf(n));
P('  兩端科判標籤**完全相同**: ' + nf(labSame) + ' = ' + (100 * labSame / n).toFixed(1) + '%');
P('  兩端 tier 相同: ' + nf(tierSame) + ' = ' + (100 * tierSame / n).toFixed(1) + '%');
P('  兩端 seq 相同: ' + nf(seqSame) + ' = ' + (100 * seqSame / n).toFixed(1) + '%');
P('  tier 與 seq 都相同（＝產生器原樣抄 id）: ' + nf(bothSame) + ' = ' + (100 * bothSame / n).toFixed(1) + '%');
P('  任一端標籤為空: ' + nf(labEmpty));
P('\n  標籤不同的實例（前 10）:');
for (const e of ex) P(e);
P('\n=== 按系列對的標籤一致率（邊數 >=500）===');
const rows = [...byPair.entries()].filter(([, v]) => v.n >= 500).sort((a, b) => b[1].n - a[1].n);
P('  ' + 'pair'.padEnd(24) + 'edges'.padStart(9) + 'labelSame'.padStart(11) + '   pct');
for (const [k, v] of rows.slice(0, 20)) P('  ' + k.padEnd(24) + nf(v.n).padStart(9) + nf(v.lab).padStart(11) + '   ' + (100 * v.lab / v.n).toFixed(1) + '%');
fs.writeFileSync(OUT + '/anchor-edge-quality.txt', o.join('\n'), 'utf8');
console.log(o.join('\n'));
