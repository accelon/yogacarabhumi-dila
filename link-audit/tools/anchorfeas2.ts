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
  const base = f.replace(/\.md$/, ''); const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n'); const set = new Set();
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

// A. N:1 拆解：同一目標收到的來源，是同系列還是跨系列
const fan = new Map();
for (const e of EDGES) { if (!fan.has(e.t)) fan.set(e.t, new Set()); fan.get(e.t).add(e.s); }
let sameOnly = 0, crossFan = 0, mixed = 0; const fanSizes = [];
for (const [t, s] of fan) { if (s.size < 2) continue; fanSizes.push(s.size);
  const ser = new Set([...s].map(k => NODE.get(k).series)); const tser = NODE.get(t).series;
  const others = [...ser].filter(x => x !== tser);
  if (others.length === 0) sameOnly++; else if (ser.size === 1) crossFan++; else mixed++; }
fanSizes.sort((a, b) => a - b);
P('=== A. N:1 的性質（一個目標錨點收到多個來源）===');
P('  有 fan-in>1 的目標錨點 ' + nf(fanSizes.length) + '；fan-in 中位 ' + fanSizes[fanSizes.length >> 1] + '  p95 ' + fanSizes[Math.floor(fanSizes.length * .95)] + '  max ' + fanSizes[fanSizes.length - 1]);
P('  來源全屬同一系列（＝該系列內部粒度差，非跨版本問題）: ' + nf(sameOnly));
P('  來源跨系列（＝真正的跨版本匯聚，可當 canonical anchor）: ' + nf(crossFan + mixed));

// B. 元件純度分級
let clean = 0, near = 0, messy = 0, hub = 0;
const cleanList = [], messyList = [];
for (const c of multi) {
  const labs = new Set(c.map(k => NODE.get(k).label).filter(x => x));
  const ser = new Set(c.map(k => NODE.get(k).series));
  if (c.length > 30) { hub++; messyList.push(c); continue; }
  if (labs.size <= 1) { clean++; cleanList.push(c); } else if (labs.size === 2) near++; else { messy++; messyList.push(c); }
}
P('\n=== B. 跨系列元件純度（共 ' + nf(multi.length) + '）===');
P('  乾淨（標籤全一致、size≤30）: ' + nf(clean) + '  (' + (100 * clean / multi.length).toFixed(1) + '%)');
P('  近似（2 種標籤）: ' + nf(near) + '  (' + (100 * near / multi.length).toFixed(1) + '%)');
P('  混雜（≥3 種標籤）: ' + nf(messy) + '  (' + (100 * messy / multi.length).toFixed(1) + '%)');
P('  巨型元件（size>30，疑似 hub 過度合併）: ' + nf(hub));
const cleanNodes = cleanList.reduce((a, c) => a + c.length, 0);
P('  乾淨元件涵蓋節點 ' + nf(cleanNodes) + ' = 全部錨點的 ' + (100 * cleanNodes / NODE.size).toFixed(1) + '%  ← 可機器提案（draft）的規模');

// C. 藏文骨架系列在元件中的 presence
const tib = new Set(['CT3267', 'CT3282', 'CT3283', 'CT3278', 'CT3252', 'CT3258', 'CT3263', 'AS-sG', 'AS-sP', 'Sh-ST', 'Sh-SH', 'Sh-SS', 'Sh-TS']);
let withTib = 0, tibOnly = 0;
for (const c of multi) { const s = new Set(c.map(k => NODE.get(k).series)); if ([...s].some(x => tib.has(x))) withTib++; }
P('\n=== C. 藏文骨架系列 ===');
P('  跨系列元件中含藏文骨架系列者 ' + nf(withTib) + ' / ' + nf(multi.length) + ' = ' + (100 * withTib / multi.length).toFixed(1) + '%');

// D. 抽樣：乾淨 vs 混雜
function dump(c, tag) {
  P('\n  --- ' + tag + '（' + c.length + ' 節點，' + new Set(c.map(k => NODE.get(k).series)).size + ' 系列）---');
  for (const k of c.slice(0, 8)) { const n = NODE.get(k); P('    ' + n.file + ':' + n.line + '  t' + n.tier + '-' + String(n.seq).padStart(3, '0') + '  「' + n.raw.slice(0, 30) + '」'); }
}
cleanList.sort((a, b) => b.length - a.length);
dump(cleanList.find(c => c.length >= 4 && c.length <= 8) || cleanList[0], '乾淨元件例');
messyList.sort((a, b) => b.length - a.length);
dump(messyList.find(c => c.length >= 5 && c.length <= 10) || messyList[0], '混雜元件例');
dump(messyList[0], '最大混雜元件（前 8）');

// E. 與 AUTO 標題匹配法交叉驗證
const auto = fs.readFileSync(OUT + '/auto-fixable.csv', 'utf8').split('\n').slice(1).filter(x => x.trim());
P('\n=== D. 兩種方法交叉驗證 ===');
P('  連結圖元件法：跨系列元件 ' + nf(multi.length) + '，其中乾淨 ' + nf(clean));
P('  標題唯一匹配法（auto-fixable.csv）：' + nf(auto.length) + ' 條已驗證改錨建議');
P('  两法独立：前者靠既有互鏈斷言，后者靠科判標題文字；可互为验证集');
fs.writeFileSync(OUT + '/anchor-feasibility2.txt', o.join('\n'), 'utf8');
console.log(o.join('\n'));
