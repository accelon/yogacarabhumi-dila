#!/usr/bin/env bun
/** 歸因：PXJ-H 帶 kpD 標題中未被干支鏈行認領者，原因分類＋樣本＋分層分佈。 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const GAN = '甲乙丙丁戊己庚辛壬癸', ZHI = '子丑寅卯辰巳午未申酉戌亥';
const tierOfChar = (c: string) => { const g = GAN.indexOf(c); return g >= 0 ? g + 1 : ZHI.indexOf(c) + 11; };
const charOfTier = (t: number) => t <= 10 ? GAN[t - 1]! : (t <= 22 ? ZHI[t - 11]! : '');
function cnParse(x: string): number {
  const U = '一二三四五六七八九';
  if (x === '十') return 10;
  let m = /^十(.)$/.exec(x); if (m) return 10 + U.indexOf(m[1]!) + 1;
  m = /^(.)十(.?)$/.exec(x); if (m) { const a = U.indexOf(m[1]!) + 1; if (a < 1) return 0; return a * 10 + (m[2] ? U.indexOf(m[2]!) + 1 : 0); }
  return U.indexOf(x) + 1;
}
const cnGen = (n: number): string => {
  const U = '一二三四五六七八九';
  if (n <= 10) return n === 10 ? '十' : U[n - 1]!;
  if (n < 20) return '十' + U[n - 11]!;
  if (n === 20) return '二十';
  if (n < 30) return '二十' + U[n - 21]!;
  if (n % 10 === 0) return U[n / 10 - 1]! + '十';
  return n < 40 ? '三十' + U[n - 31]! : '四十' + (n === 40 ? '' : U[n - 41]!);
};
const files = fs.readdirSync(ROOT).filter((f) => /^PXJ-H-\d+\.md$/.test(f)).sort((a, b) => +(/(\d+)\.md/.exec(a)![1]!) - +(/(\d+)\.md/.exec(b)![1]!));
const reason = new Map<string, number>();
const samples: string[] = [];
const byTier = new Map<number, { hd: number; unclaimed: number }>();
let totHd = 0, totUn = 0;
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n?/g, '\n').split('\n');
  type H = { tier: number; anchor: string; title: string; sp: number; li: number; claimed: boolean };
  const hds: H[] = [];
  lines.forEach((ln, li) => {
    const hm = /^(#{1,6})\s+(.*)$/.exec(ln);
    if (!hm) return;
    const am = /\^(kpD(\d+)-(\d+))/.exec(hm[2]!);
    if (!am) return;
    const tt = hm[2]!.replace(/\s*\^kpD\d+-\d+\s*$/, '').replace(/\^kp#[^\s（]*/g, '').trim();
    hds.push({ tier: +am[2]!, anchor: am[1]!, title: tt.replace(/^[A-Z]?\d*\s*/, '').trim(), sp: 0, li, claimed: false });
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
  // 段索引：key → {rest, li}[]
  const segsByKey = new Map<string, { rest: string; li: number }[]>();
  lines.forEach((ln, li) => {
    if (/^#/.test(ln) || /^\[\^/.test(ln) || /^《/.test(ln)) return;
    for (const seg of ln.split('　')) {
      const m = /^([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])([一二三四五六七八九十]{1,3})、(.*)$/.exec(seg.trim());
      if (!m) continue;
      const tier = tierOfChar(m[1]!); const seq = cnParse(m[2]!);
      if (!tier || !seq) continue;
      (segsByKey.get(`${tier}-${seq}`) ?? segsByKey.set(`${tier}-${seq}`, []).get(`${tier}-${seq}`)!).push({ rest: m[3]!.trim(), li });
    }
  });
  // 複製 builder 的認領（最近者勝）；v9 起含寬容反查：號不合時同層標題優先、30 行內
  const winner = new Map<string, H>();
  const allByTier = new Map<number, H[]>();
  for (const h of hds) (allByTier.get(h.tier) ?? allByTier.set(h.tier, []).get(h.tier)!).push(h);
  for (const [k, segs] of segsByKey) {
    const cands0 = byKey.get(k);
    if (!cands0?.length) continue;
    for (const s of segs) {
      const good = cands0.filter((c) => c.title && s.rest.startsWith(c.title));
      if (!good.length) continue;
      const w = good.reduce((a, b) => (Math.abs(b.li - s.li) < Math.abs(a.li - s.li) ? b : a));
      w.claimed = true; winner.set(k + '@' + s.li, w);
    }
  }
  for (const [k, segs] of segsByKey) {
    const [tierS] = k.split('-');
    const tier = +tierS!;
    for (const s of segs) {
      const good0 = (byKey.get(k) ?? []).filter((c) => c.title && s.rest.startsWith(c.title));
      if (good0.length) continue;   // 嚴格路已認領
      const alt = (allByTier.get(tier) ?? []).filter((c) => c.title && s.rest.startsWith(c.title) && Math.abs(c.li - s.li) <= 30 && !c.claimed);
      if (alt.length) alt.reduce((a, b) => (Math.abs(b.li - s.li) < Math.abs(a.li - s.li) ? b : a)).claimed = true;
    }
  }
  totHd += hds.length;
  for (const h of hds) {
    const t = byTier.get(h.tier) ?? { hd: 0, unclaimed: 0 }; t.hd++; byTier.set(h.tier, t);
    if (h.claimed) continue;
    totUn++; t.unclaimed++;
    let r: string;
    if (h.tier > 22) r = '①層>22 無干支字符';
    else {
      const k = `${h.tier}-${h.sp}`;
      const segs = segsByKey.get(k);
      if (!segs?.length) r = '③鏈行根本沒列此號';
      else if (!segs.some((s) => h.title && s.rest.startsWith(h.title))) r = '④有同號段但文字不合';
      else r = '②同號多候選被更近者搶走';
    }
    reason.set(r, (reason.get(r) ?? 0) + 1);
    if (samples.length < 14 && r.startsWith('④')) {
      const s = segsByKey.get(`${h.tier}-${h.sp}`)!.find((x) => x.rest.length > 0)!;
      samples.push(`${base} ${charOfTier(h.tier)}${cnGen(h.sp)}、標題「${h.title}」vs 鏈行「${s.rest.slice(0, 24)}」`);
    }
  }
}
console.log(`PXJ-H 帶 kpD 標題 ${totHd}，未認領 ${totUn}（${(100 * totUn / totHd).toFixed(1)}%）`);
for (const [r, n] of [...reason.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${r}：${n}（${(100 * n / totUn).toFixed(1)}%）`);
console.log('④文字不合樣本：\n  ' + samples.slice(0, 8).join('\n  '));
const tiers = [...byTier.entries()].filter(([, v]) => v.unclaimed > 0).sort((a, b) => b[1].unclaimed - a[1].unclaimed).slice(0, 8);
console.log('未認領分層 top：', tiers.map(([t, v]) => `層${t}:${v.unclaimed}/${v.hd}`).join(' '));
