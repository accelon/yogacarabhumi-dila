import fs from 'fs';
import path from 'path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const OUT = ROOT + '/link-audit/data';
const o = []; const P = (...a) => o.push(a.join(' '));
const nf = n => Number(n).toLocaleString('en-US');
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.md'));
const seriesOf = b => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
// 修正：剝掉 （缺、（分N、缺） 等編者附註，再比標籤
const norm = t => (t || '')
  .replace(/^[A-Za-z甲乙丙丁戊己庚辛壬癸]\s*\d*\s*/, '')
  .replace(/[（(][^）)]*[）)]/g, '')
  .replace(/缺/g, '')
  .replace(/\d+/g, '')
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
const ALL = [], GOOD = [];
const byPair = new Map();
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
      const same = s.label.length > 0 && s.label === t.label;
      ALL.push({ s: ctx, t: tk, same });
      if (same) GOOD.push({ s: ctx, t: tk });
      const pk = s.series + '>' + t.series; const e = byPair.get(pk) ?? { n: 0, g: 0 }; e.n++; if (same) e.g++; byPair.set(pk, e);
    }
  }
}
P('=== 修正正規化後：已解析邊的語意品質 ===');
P('  邊 ' + nf(ALL.length) + '；標籤一致 ' + nf(GOOD.length) + ' = ' + (100 * GOOD.length / ALL.length).toFixed(1) + '%（修正前 44.7%）');
P('\n=== 按系列對（邊數 >=200，依一致率排序）===');
P('  ' + 'pair'.padEnd(24) + 'edges'.padStart(8) + 'agree'.padStart(8) + '   pct   判定');
const pr = [...byPair.entries()].filter(([, v]) => v.n >= 200).sort((a, b) => (b[1].g / b[1].n) - (a[1].g / a[1].n));
for (const [k, v] of pr) { const p = v.g / v.n; P('  ' + k.padEnd(24) + nf(v.n).padStart(8) + nf(v.g).padStart(8) + '   ' + (100 * p).toFixed(1) + '%  ' + (p >= .9 ? '可用' : p >= .6 ? '待核' : '不可用')); }
const usable = pr.filter(([, v]) => v.g / v.n >= .9);
P('\n  一致率 >=90% 的系列對: ' + usable.length + ' 組，涵蓋邊 ' + nf(usable.reduce((a, [, v]) => a + v.n, 0)));
const unusable = pr.filter(([, v]) => v.g / v.n < .6);
P('  一致率 <60% 的系列對: ' + unusable.length + ' 組，涵蓋邊 ' + nf(unusable.reduce((a, [, v]) => a + v.n, 0)) + '（這些邊不能當 posmap）');

// 只用「標籤一致」的邊重建圖
function build(edges) {
  const parent = new Map(); const find = x => { let r = x; while (parent.get(r) !== r) r = parent.get(r); let c = x; while (parent.get(c) !== c) { const n = parent.get(c); parent.set(c, r); c = n; } return r; };
  for (const k of NODE.keys()) parent.set(k, k);
  for (const e of edges) { const a = find(e.s), b = find(e.t); if (a !== b) parent.set(a, b); }
  const comp = new Map(); for (const k of NODE.keys()) { const r = find(k); (comp.get(r) ?? comp.set(r, []).get(r)).push(k); }
  return { comp, find };
}
for (const [tag, edges] of [['全部已解析邊', ALL], ['只用標籤一致邊', GOOD]]) {
  const { comp } = build(edges);
  const multi = [...comp.values()].filter(c => new Set(c.map(k => NODE.get(k).series)).size >= 2);
  let flat = 0, flatAgree = 0, safe = 0, safeNodes = 0, hier = 0;
  for (const c of multi) {
    const m = new Map(); for (const k of c) { const s = NODE.get(k).series; m.set(s, (m.get(s) || 0) + 1); }
    const labs = [...new Set(c.map(k => NODE.get(k).label).filter(x => x))];
    if (Math.max(...m.values()) === 1) { flat++; if (labs.length === 1) { flatAgree++; if (labs[0].length > 2) { safe++; safeNodes += c.length; } } } else hier++;
  }
  P('\n=== ' + tag + ' 建圖 ===');
  P('  跨系列元件 ' + nf(multi.length) + '；扁平 ' + nf(flat) + '；扁平+標籤一致 ' + nf(flatAgree) + '；再扣短標籤 ' + nf(safe) + '（涵蓋 ' + nf(safeNodes) + ' 錨點）；階層 ' + nf(hier));
}
fs.writeFileSync(OUT + '/anchor-edge-quality2.txt', o.join('\n'), 'utf8');
fs.writeFileSync(OUT + '/anchor-pair-quality.csv', 'pair,edges,label_agree,pct,verdict\n' +
  [...byPair.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, v.n, v.g, (100 * v.g / v.n).toFixed(2), v.g / v.n >= .9 ? 'usable' : v.g / v.n >= .6 ? 'review' : 'unusable'].join(',')).join('\n'), 'utf8');
console.log(o.join('\n'));
