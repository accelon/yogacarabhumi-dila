#!/usr/bin/env bun
/**
 * D 層（書內現成跨庫掛鏈）覆蓋率盤點：
 * 注文各卷的科判標題下常掛 《[[T1579-63#^kpD04-059|瑜伽]]》《[[PXJ-H-13#^kpD06-022|披尋記]]》——
 * 這是 DILA 自己標的對應，比標題 LCS 猜測更硬。兩者的窗都已在 spans-j-verified.tsv（T1579/PXJ 兩套）驗過。
 * 本腳本量：每部有多少科判可由 D1(T1579)/D2(PXJ) 直接落地、段落覆蓋多少。
 */
import fs from 'node:fs';
const VAULT = 'D:/2026/yogacarabhumi-dila';
const win = new Map<string, { page: string; js: number; je: number }>();
for (const ln of fs.readFileSync('D:/2026/_scratch-ybh/spans-j-verified.tsv', 'utf8').split(/\r?\n/).slice(1)) {
  const c = ln.split('\t');
  if (c.length < 6 || !c[3] || c[4] === '' || c[5] === '' || !/^(T|N)/.test(c[6] ?? '')) continue;
  win.set(`${c[1]}#${c[2]}`, { page: c[3]!, js: +c[4]!, je: +c[5]! });
}
const LINK = /^《\[\[(T1579-\d+|PXJ-H-\d+)#\^(kpD\d+-\d+)(?:[^\]]*)\]\]》\s*$/;
const HEAD = /^(#{1,6})\s+(.+?)\s*\^(kpD\d+-\d+)\s*$/;
const hanOnly = (x: string) => x.replace(/[^一-鿿]/g, '');
const rows: string[] = ['series\theadings\tD1有\tD1窗\tD2有\tD2窗\tDany窗\tparas\tpara在D窗科判下'];
for (const ser of ['T1580', 'T1828', 'T1829', 'PXJ-H', 'T2801', 'T2802', 'T2259']) {
  const files = fs.readdirSync(VAULT).filter((f) => new RegExp(`^${ser.replace(/-/g, '\\-')}-\\d+\\.md$`).test(f))
    .sort((a, b) => +/-(\d+)\.md$/.exec(a)![1]! - +/-(\d+)\.md$/.exec(b)![1]!);
  let hd = 0, d1 = 0, d1w = 0, d2 = 0, d2w = 0, anyw = 0, para = 0, paraW = 0;
  for (const f of files) {
    const base = f.replace(/\.md$/, '');
    const ls = fs.readFileSync(`${VAULT}/${f}`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    let curWin: { page: string; js: number; je: number } | null = null;
    for (let i = 0; i < ls.length; i++) {
      const t = ls[i]!.trim();
      const h = HEAD.exec(t);
      if (h) {
        hd++;
        // 看此標題之後（到下一標題前）的掛鏈行
        let w: { page: string; js: number; je: number } | null = null, s1 = false, s2 = false;
        for (let j = i + 1; j < ls.length; j++) {
          const x = ls[j]!.trim();
          if (/^#{1,6}\s/.test(x)) break;
          if (!x) continue;
          if (!/^《\[\[/.test(x)) break;                       // 掛鏈塊只在標題後連續幾行
          const m = LINK.exec(x);
          if (!m) continue;
          const sp = win.get(`${m[1]}#${m[2]}`);
          if (!sp) continue;
          if (m[1]!.startsWith('T1579')) { s1 = true; if (!w) w = sp; }
          else { s2 = true; if (!w) w = sp; }
        }
        if (s1) { d1++; if (w) d1w++; }
        if (s2) { d2++; if (w) d2w++; }
        curWin = w;
        if (w) anyw++;
        continue;
      }
      if (!t || /^《/.test(t) || /^\[\^/.test(t) || /^\|/.test(t) || /^(No\.|[\d.]+\[|[瑜伽多]|卷第)/.test(t)) continue;
      const prev = i > 0 ? ls[i - 1]!.trim() : '';
      if (prev && !/^《/.test(prev) && !/^\[\^/.test(prev) && !/^#/.test(prev) && !/^\|/.test(prev) && !/^(No\.|[\d.]+\[|[瑜伽多]|卷第)/.test(prev)) continue;
      if (hanOnly(t.replace(/\[\[[^\]]*\]\]/g, '')).length < 8) continue;
      para++;
      if (curWin) paraW++;
    }
  }
  console.log(`${ser}: 科判 ${hd}｜D1(T1579) 有 ${d1}（帶窗 ${d1w}）｜D2(披尋記) 有 ${d2}（帶窗 ${d2w}）｜任一窗 ${anyw}｜段落 ${para}→落在有窗科判下 ${paraW}`);
  rows.push([ser, hd, d1, d1w, d2, d2w, anyw, para, paraW].join('\t'));
}
fs.writeFileSync('D:/2026/_scratch-ybh/dlayer-inventory.tsv', rows.join('\n') + '\n', 'utf8');
console.log('→ dlayer-inventory.tsv');
