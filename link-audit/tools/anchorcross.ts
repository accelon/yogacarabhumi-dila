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

// ---- 建圖（方法 A：已解析互鏈的連通元件）----
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
// 提案集：扁平 + 標籤一致 + 標籤 >2 字
const PROPOSED = new Set();
for (const c of comp.values()) {
  const bySer = new Map(); for (const k of c) { const s = NODE.get(k).series; bySer.set(s, (bySer.get(s) || 0) + 1); }
  if (bySer.size < 2 || Math.max(...bySer.values()) !== 1) continue;
  const labs = [...new Set(c.map(k => NODE.get(k).label).filter(x => x))];
  if (labs.length !== 1 || labs[0].length <= 2) continue;
  for (const k of c) PROPOSED.add(k);
}
P('=== 方法 A（互鏈圖連通元件）===');
P('  節點 ' + nf(NODE.size) + '，邊 ' + nf(EDGES.length) + '，元件 ' + nf(comp.size));
P('  提案集（扁平+標籤一致+>2字）涵蓋節點 ' + nf(PROPOSED.size));

// ---- 方法 B：auto-fixable.csv（標題唯一匹配，修的是落空鏈）----
const csv = t => { const R = []; let c = [], q = false, s = '';
  for (let i = 0; i < t.length; i++) { const ch = t[i];
    if (ch === '"') { if (q && t[i + 1] === '"') { s += '"'; i++; } else q = !q; }
    else if (ch === ',' && !q) { c.push(s); s = ''; }
    else if ((ch === '\n' || ch === '\r') && !q) { if (s !== '' || c.length) { c.push(s); R.push(c); c = []; s = ''; } }
    else s += ch; }
  if (s !== '' || c.length) { c.push(s); R.push(c); } return R; };
const rows = csv(fs.readFileSync(OUT + '/auto-fixable.csv', 'utf8'));
const H = rows[0]; const ix = k => H.indexOf(k);
P('\n=== 方法 B（標題唯一匹配，auto-fixable.csv）===');
P('  列數 ' + nf(rows.length - 1) + '；作用对象＝落空鏈（与 A 的已解析鏈互補）');

let agree = 0, disagree = 0, srcMissing = 0, tgtMissing = 0, bothMissing = 0, same = 0;
let agreeInProposed = 0, disagreeInProposed = 0;
const dis = [];
for (let i = 1; i < rows.length; i++) {
  const r = rows[i];
  const sf = r[ix('source_file')], ca = r[ix('ctx_anchor')], tf = r[ix('target_file')], sa = r[ix('suggested_anchor')];
  if (!ca || !sa) continue;
  const sk = sf + '#' + ca, tk = tf + '#' + sa;
  if (sk === tk) { same++; continue; }
  const hasS = NODE.has(sk), hasT = NODE.has(tk);
  if (!hasS && !hasT) { bothMissing++; continue; }
  if (!hasS) { srcMissing++; continue; }
  if (!hasT) { tgtMissing++; continue; }
  if (find(sk) === find(tk)) { agree++; if (PROPOSED.has(sk) && PROPOSED.has(tk)) agreeInProposed++; }
  else { disagree++; if (PROPOSED.has(sk) || PROPOSED.has(tk)) disagreeInProposed++;
    if (dis.length < 4000) dis.push([sf, r[ix('line')], ca, tf, sa, NODE.get(sk).raw.slice(0, 24), NODE.get(tk).raw.slice(0, 24), find(sk), find(tk)].join(',')); }
}
const tot = agree + disagree;
P('\n=== 交叉驗證結果 ===');
P('  兩端都在圖內、可比的配對: ' + nf(tot));
P('  **吻合**（B 建議的目標与 A 的元件一致）: ' + nf(agree) + '  = ' + (100 * agree / tot).toFixed(1) + '%');
P('  **不吻合**（落在不同元件）: ' + nf(disagree) + '  = ' + (100 * disagree / tot).toFixed(1) + '%');
P('  其中吻合且兩端都在提案集內: ' + nf(agreeInProposed));
P('  不吻合但至少一端在提案集內（需优先人工看）: ' + nf(disagreeInProposed));
P('  無法比: 來源錨點不在圖內 ' + nf(srcMissing) + '、目標不在圖內 ' + nf(tgtMissing) + '、兩端都不在 ' + nf(bothMissing) + '、自指 ' + nf(same));

// 不吻合的性質：是不是「階層」造成（B 的目標是粗節點、A 把來源归到細節點）
let disHier = 0, disFlat = 0;
for (let i = 1; i < rows.length; i++) {
  const r = rows[i]; const sk = r[ix('source_file')] + '#' + r[ix('ctx_anchor')], tk = r[ix('target_file')] + '#' + r[ix('suggested_anchor')];
  if (!NODE.has(sk) || !NODE.has(tk) || find(sk) === find(tk)) continue;
  const cs = comp.get(find(sk)), ct = comp.get(find(tk));
  const flat = c => { const m = new Map(); for (const k of c) { const s = NODE.get(k).series; m.set(s, (m.get(s) || 0) + 1); } return Math.max(...m.values()) === 1; };
  if (!flat(cs) || !flat(ct)) disHier++; else disFlat++;
}
P('\n  不吻合的成因拆解: 至少一端屬「階層元件」 ' + nf(disHier) + '；兩端都是扁平元件卻仍不同 ' + nf(disFlat));
P('  → 前者是粒度差（可用 splits 邊化解），後者才是真正的方法衝突');
fs.writeFileSync(OUT + '/anchor-crosscheck.txt', o.join('\n'), 'utf8');
fs.writeFileSync(OUT + '/anchor-crosscheck-disagree.csv', 'source_file,line,ctx_anchor,target_file,suggested_anchor,src_label,tgt_label,comp_src,comp_tgt\n' + dis.join('\n'), 'utf8');
console.log(o.join('\n'));
