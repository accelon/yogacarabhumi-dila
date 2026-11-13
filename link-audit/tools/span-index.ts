#!/usr/bin/env bun
/**
 * span-index v3：j 座標系＝pageHanTextOf 產物本身（renderEmbed 用它切片，定義即一致）。
 * 每頁取 pageHanTextOf 純漢字串快取；行 jstart = 引文前 6 字 indexOf；
 * 找不到 → 降級為純頁欄聯（無 j 窗），計數如實報。
 * jend：T1579＝同頁下一 span 的 jstart（≤400）；披尋記＝引文漢字長（≤200）；皆挾頁串長。
 */
import fs from 'node:fs';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { pageHanTextOf } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const hanCache = new Map<string, string>();
const hanOf = async (page: string): Promise<string> => {
  let h = hanCache.get(page);
  if (h === undefined) { h = await pageHanTextOf(rd, page); hanCache.set(page, h); }
  return h;
};
const strip = (s: string) => s.replace(/[^一-鿿]/g, '');

// 披尋記引文漢字數（源檔重抽，同 v1 規則）
const quoteLen = new Map<string, number>();
{
  const GZ = /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥][一二三四五六七八九十]{1,3}、/;
  for (const f of fs.readdirSync('D:/2026/yogacarabhumi-dila').filter((x) => /^PXJ-H-\d+\.md$/.test(x))) {
    const base = f.replace(/\.md$/, '');
    const ls = fs.readFileSync(`D:/2026/yogacarabhumi-dila/${f}`, 'utf8').replace(/\r\n?/g, '\n').split('\n');
    let pending: string | null = null;
    for (const ln of ls) {
      const hd = /^#{1,6}\s+(.*?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln);
      if (hd) { pending = hd[2]!; continue; }
      if (!pending) continue;
      const t = ln.trim();
      if (!t || /^《/.test(t) || /^\[\^/.test(t)) continue;
      const segs = t.split('　').map((x) => x.trim()).filter(Boolean);
      if (segs.length && segs.every((x) => GZ.test(x))) continue;
      quoteLen.set(`${base}#${pending}`, strip(t).length);
      pending = null;
    }
  }
}

const out: string[] = ['lib\tbase\tkp\tpage\tjstart\tjend\tmode'];
let withJ = 0, noJ = 0, demote = 0;
for (const [lib, file] of [['T1579', 'spans-t1579.tsv'], ['PXJ', 'spans-pxj.tsv']] as const) {
  const rows = fs.readFileSync(`D:/2026/_scratch-ybh/${file}`, 'utf8').split('\n').slice(1).filter(Boolean).map((r) => r.split('\t'));
  // 第一遍：每行算 jstart（T/N 且有引文者）
  const js = new Map<number, number>();
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i]!;
    if ((c[3] !== 'T' && c[3] !== 'N') || !c[2] || !c[6]) continue;
    const key = strip(c[6]!).slice(0, 6);
    if (key.length < 4) continue;
    const han = await hanOf(c[2]!);
    const p = han.indexOf(key);
    if (p >= 0) js.set(i, p);
  }
  // 第二遍：輸出
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i]!;
    const push = (jsv: string, jev: string, md: string) => out.push([lib, c[0]!, c[1]!, c[2] ?? '', jsv, jev, md].join('\t'));
    const a = js.get(i);
    if (a === undefined) { if (c[3] === 'T' || c[3] === 'N') demote++; noJ++; push('', '', c[3] === 'T' || c[3] === 'N' ? 'demote' : c[3]!); continue; }
    const han = await hanOf(c[2]!);
    let len = 400;
    if (lib === 'PXJ') len = Math.min(Math.max(4, quoteLen.get(`${c[0]}#${c[1]}`) ?? 40), 200);
    else {
      const nx = rows[i + 1];
      if (nx && nx[0] === c[0] && js.has(i + 1)) len = Math.min(Math.max(4, js.get(i + 1)! - a), 400);
    }
    const b = Math.min(a + len, han.length);
    if (b <= a + 1) { demote++; noJ++; push('', '', 'demote'); continue; }
    withJ++;
    push(String(a), String(b), c[3]!);
  }
}
fs.writeFileSync('D:/2026/_scratch-ybh/spans-j.tsv', out.join('\n'), 'utf8');
console.log(`spans-j v3：可嵌 ${withJ}、僅聯 ${noJ}（其中降級 demote ${demote}）｜頁快取 ${hanCache.size}`);
