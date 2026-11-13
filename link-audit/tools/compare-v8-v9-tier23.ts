#!/usr/bin/env bun
/** v8(嚴格) vs v9(嚴格＋寬容反查) 分層覆蓋率；重點核層 23＋。 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const tierOfChar = (c: string) => { const g = GAN.indexOf(c); return g >= 0 ? g + 1 : ZHI.indexOf(c) + 11; };
function cnParse(x: string): number {
  const U = '一二三四五六七八九';
  if (x === '十') return 10;
  let m = /^十(.)$/.exec(x); if (m) return 10 + U.indexOf(m[1]!) + 1;
  m = /^(.)十(.?)$/.exec(x); if (m) { const a = U.indexOf(m[1]!) + 1; if (a < 1) return 0; return a * 10 + (m[2] ? U.indexOf(m[2]!) + 1 : 0); }
  return U.indexOf(x) + 1;
}
const files = fs.readdirSync(ROOT).filter((f) => /^PXJ-H-\d+\.md$/.test(f)).sort((a, b) => +(/(\d+)\.md/.exec(a)![1]!) - +(/(\d+)\.md/.exec(b)![1]!));
const per = new Map<number, { tot: number; v8: number; v9: number }>();
for (const f of files) {
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n?/g, '\n').split('\n');
  type H = { tier: number; title: string; sp: number; li: number; s8: boolean; s9: boolean };
  const hds: H[] = [];
  lines.forEach((ln, li) => {
    const hm = /^(#{1,6})\s+(.*)$/.exec(ln);
    if (!hm) return;
    const am = /\^(kpD(\d+)-(\d+))/.exec(hm[2]!);
    if (!am) return;
    const tt = hm[2]!.replace(/\s*\^kpD\d+-\d+\s*$/, '').replace(/\^kp#[^\s（]*/g, '').trim();
    hds.push({ tier: +am[2]!, title: tt.replace(/^[A-Z]?\d*\s*/, '').trim(), sp: 0, li, s8: false, s9: false });
  });
  {
    const st: H[] = []; const cnt = new Map<number, number>();
    for (const h of hds) {
      while (st.length && st[st.length - 1]!.tier >= h.tier) st.pop();
      st.push(h); cnt.set(h.tier, (cnt.get(h.tier) ?? 0) + 1);
      for (let t2 = h.tier + 1; t2 <= 60; t2++) if (cnt.has(t2)) cnt.set(t2, 0);
      h.sp = cnt.get(h.tier) ?? 1;
    }
  }
  const byKey = new Map<string, H[]>();
  for (const h of hds) (byKey.get(`${h.tier}-${h.sp}`) ?? byKey.set(`${h.tier}-${h.sp}`, []).get(`${h.tier}-${h.sp}`)!).push(h);
  const allByTier = new Map<number, H[]>();
  for (const h of hds) (allByTier.get(h.tier) ?? allByTier.set(h.tier, []).get(h.tier)!).push(h);
  lines.forEach((ln, li) => {
    if (/^#/.test(ln) || /^\[\^/.test(ln) || /^《/.test(ln)) return;
    for (const seg of ln.split('　')) {
      const m = /^([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])([一二三四五六七八九十]{1,3})、(.*)$/.exec(seg.trim());
      if (!m) continue;
      const tier = tierOfChar(m[1]!); const seq = cnParse(m[2]!);
      const rest = m[3]!.trim();
      const good = (byKey.get(`${tier}-${seq}`) ?? []).filter((c) => c.title && rest.startsWith(c.title));
      if (good.length) {
        const w = good.reduce((a, b) => (Math.abs(b.li - li) < Math.abs(a.li - li) ? b : a));
        w.s8 = true; w.s9 = true; continue;
      }
      const alt = (allByTier.get(tier) ?? []).filter((c) => c.title && rest.startsWith(c.title) && Math.abs(c.li - li) <= 30 && !c.s9);
      if (alt.length) alt.reduce((a, b) => (Math.abs(b.li - li) < Math.abs(a.li - li) ? b : a)).s9 = true;
    }
  });
  for (const h of hds) {
    const p = per.get(h.tier) ?? { tot: 0, v8: 0, v9: 0 };
    p.tot++; if (h.s8) p.v8++; if (h.s9) p.v9++; per.set(h.tier, p);
  }
}
console.log('層\t標題數\tv8嚴格\tv9寬容\tΔ\tv8覆蓋\tv9覆蓋');
let t8 = 0, t9 = 0, tt = 0;
for (const [tier, p] of [...per.entries()].sort((a, b) => a[0] - b[0])) {
  t8 += p.v8; t9 += p.v9; tt += p.tot;
  if (tier <= 24 || p.tot > 0 && tier <= 26) console.log(`${tier}\t${p.tot}\t${p.v8}\t${p.v9}\t${p.v9 - p.v8}\t${(100 * p.v8 / p.tot).toFixed(1)}%\t${(100 * p.v9 / p.tot).toFixed(1)}%`);
}
const hi = [...per.entries()].filter(([t]) => t > 22);
console.log(`\n層 23＋：標題 ${hi.reduce((s, [, p]) => s + p.tot, 0)}，v8 認領 ${hi.reduce((s, [, p]) => s + p.v8, 0)}，v9 認領 ${hi.reduce((s, [, p]) => s + p.v9, 0)}`);
console.log(`全部 ${tt}：v8 ${t8}（${(100 * t8 / tt).toFixed(1)}%）→ v9 ${t9}（${(100 * t9 / tt).toFixed(1)}%），Δ＝${t9 - t8} 全落在層≤22：`, [...per.entries()].filter(([, p]) => p.v9 > p.v8).sort((a, b) => b[1].v9 - b[1].v8 - (a[1].v9 - a[1].v8)).slice(0, 6).map(([t, p]) => `層${t}+${p.v9 - p.v8}`).join(' '));
