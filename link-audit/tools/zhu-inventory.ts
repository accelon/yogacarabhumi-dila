#!/usr/bin/env bun
/**
 * 注文段落 ref 規模盤點（決定各部規則與成本）。
 * 口徑與 span-t1580.ts 完全一致：段起＝空行/標題/《》/腳註/表行之後首行、且剝鏈後 ≥8 漢字。
 */
import fs from 'node:fs';
const VAULT = 'D:/2026/yogacarabhumi-dila';
const SERIES = ['T1580', 'T1828', 'T1829', 'PXJ-H', 'T2801', 'T2802', 'T2259', 'T1581', 'T1582', 'T1583', 'T1584', 'T1602', 'T1604', 'T1605', 'T1606', 'X0794'];
const hanOnly = (x: string) => x.replace(/[^一-鿿]/g, '');
// 已驗窗（spans-j-verified.tsv）覆蓋的 base
const spanned = new Set<string>();
for (const ln of fs.readFileSync('D:/2026/_scratch-ybh/spans-j-verified.tsv', 'utf8').split(/\r?\n/).slice(1)) {
  const c = ln.split('\t');
  if (c.length >= 6 && c[3] && c[4] !== '' && c[5] !== '' && /^(T|N)/.test(c[6] ?? '')) spanned.add(`${c[1]}#${c[2]}`);
}
const rows: string[] = ['series\tvolFiles\theadings\theadingsWithSpan\tparas\tparasInSpanKp\trish曰\trish釋曰\thancjk(M)'];
console.log('系列\t卷檔\t科判\t已有驗窗\t段落\t段落落在有窗科判\t…曰\t釋曰\t漢字(萬)');
for (const ser of SERIES) {
  const files = fs.readdirSync(VAULT).filter((f) => new RegExp(`^${ser.replace(/-/g, '\\-')}-\\d+\\.md$`).test(f));
  let hd = 0, hdSpan = 0, para = 0, paraSpan = 0, yue = 0, shiyue = 0, han = 0;
  for (const f of files) {
    const base = f.replace(/\.md$/, '');
    const ls = fs.readFileSync(`${VAULT}/${f}`, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
    let cur = '';
    for (let i = 0; i < ls.length; i++) {
      const t = ls[i]!.trim();
      const h = /^#{1,6}\s+.*?\^(kpD\d+-\d+)\s*$/.exec(t);
      if (h) { hd++; cur = h[1]!; if (spanned.has(`${base}#${cur}`)) hdSpan++; continue; }
      if (!t || /^《/.test(t) || /^\[\^/.test(t) || /^\|/.test(t)) continue;
      const prev = i > 0 ? ls[i - 1]!.trim() : '';
      if (prev && !/^《/.test(prev) && !/^\[\^/.test(prev) && !/^#/.test(prev) && !/^\|/.test(prev)) continue;
      const clean = hanOnly(t.replace(/\[\[[^\]]*\]\]/g, '').replace(/\^[A-Za-z0-9_-]+/g, ''));
      if (clean.length < 8) continue;
      para++; han += clean.length;
      if (spanned.has(`${base}#${cur}`)) paraSpan++;
      yue += (t.match(/[曰]：/g) ?? []).length;
      shiyue += (t.match(/^釋曰：|　釋曰：/g) ?? []).length;
    }
  }
  console.log(`${ser}\t${files.length}\t${hd}\t${hdSpan}\t${para}\t${paraSpan}\t${yue}\t${shiyue}\t${(han / 10000).toFixed(1)}`);
  rows.push([ser, files.length, hd, hdSpan, para, paraSpan, yue, shiyue, (han / 10000).toFixed(1)].join('\t'));
}
fs.writeFileSync('D:/2026/_scratch-ybh/zhu-inventory.tsv', rows.join('\n') + '\n', 'utf8');
console.log('→ zhu-inventory.tsv');
