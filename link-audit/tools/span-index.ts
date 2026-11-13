#!/usr/bin/env bun
/**
 * j 索引換算 v1（定稿）：已解 VA → taisho 頁內漢字區間 j="a-b"（口徑＝renderEmbed 頁分支：
 * 頁起點標記後、至下一 <頁 標記前，isHan 計序）。T/N 出 j；I 僅聯。
 * jend：T1579＝同卷下一已解 span（挾頁尾，≤400）；披尋記＝引文行漢字長（挾頁尾，≤200）。
 */
import fs from 'node:fs';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const mp = new VaPaMapper(rd);
await mp.init();
const tags = rd.containers.get('tags')!;
const sVas = await rd.decodeBlockList('tags', tags.names.indexOf('書'));
const sNames = await rd.cachedStrings('書');
const at0 = sNames.findIndex((n) => n.includes('瑜伽師地論'));
const lo30 = sVas[at0]!, hi30 = at0 + 1 < sVas.length ? sVas[at0 + 1]! : rd.header.maxBlockOffset;

// 單趟掃描：行起累計漢字、頁標起序表
const l0 = mp.edgeLine(lo30), l1 = mp.edgeLine(hi30);
const lineStart: number[] = [];
const linePlain: string[] = [];
const pageStart = new Map<string, number>();
let acc = 0;
for (let L = l0; L <= l1; L++) {
  const raw = await mp.lineText(L);
  lineStart[L - l0] = acc;
  let i = 0, before = 0;
  while (i < raw.length) {
    if (raw.startsWith('<頁 id=', i)) {
      const e = raw.indexOf('>', i);
      const pid = (/id="([^"]+)"/.exec(raw.slice(i, e)) ?? [, ''])[1] as string;
      if (pid && !pageStart.has(pid)) pageStart.set(pid, acc + before);
      i = e + 1; continue;
    }
    if (raw[i] === '<') { const e = raw.indexOf('>', i); i = e < 0 ? raw.length : e + 1; continue; }
    const cp = raw.codePointAt(i)!;
    if (/\p{Script=Han}/u.test(String.fromCodePoint(cp))) before++;
    i += cp > 0xffff ? 2 : 1;
  }
  const plain = raw.replace(/<[^>]*>/g, '');
  linePlain[L - l0] = plain;
  acc += (plain.match(/\p{Script=Han}/gu) ?? []).length;
}
const pageOrder = [...pageStart.entries()].sort((a, b) => a[1] - b[1]);
function pageLen(p: string): number {
  const k = pageOrder.findIndex((x) => x[0] === p);
  if (k < 0) return 0;
  return (k + 1 < pageOrder.length ? pageOrder[k + 1]![1] : acc) - pageOrder[k]![1];
}
function gOf(va: number, quote: string): number | null {
  const key = quote.replace(/[^一-鿿]/g, '').slice(0, 4);
  if (key.length < 4) return null;
  const L = mp.edgeLine(va) - l0;
  if (L < 0 || L >= linePlain.length) return null;
  const han = [...(linePlain[L] ?? '')].filter((c) => /\p{Script=Han}/u.test(c));
  for (let k = 0; k + 4 <= han.length; k++) if (han.slice(k, k + 4).join('') === key) return lineStart[L]! + k;
  return null;
}

// 披尋記引文實際漢字數
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
      quoteLen.set(`${base}#${pending}`, (t.match(/\p{Script=Han}/gu) ?? []).length);
      pending = null;
    }
  }
}

const out: string[] = ['lib\tbase\tkp\tpage\tjstart\tjend\tmode'];
let withJ = 0, noJ = 0;
for (const [lib, file] of [['T1579', 'spans-t1579.tsv'], ['PXJ', 'spans-pxj.tsv']] as const) {
  const rows = fs.readFileSync(`D:/2026/_scratch-ybh/${file}`, 'utf8').split('\n').slice(1).filter(Boolean).map((r) => r.split('\t'));
  const g = new Map<number, number>();
  rows.forEach((c, i) => {
    if ((c[3] === 'T' || c[3] === 'N') && c[5]) g.set(i, gOf(+c[5]!, c[6] ?? '')!);
  });
  rows.forEach((c, i) => {
    const push = (js: string, je: string, md: string) => out.push([lib, c[0]!, c[1]!, c[2] ?? '', js, je, md].join('\t'));
    if ((c[3] !== 'T' && c[3] !== 'N') || !c[5] || !c[2]) { noJ++; push('', '', c[3] ?? ''); return; }
    const gg = g.get(i);
    if (gg == null) { noJ++; push('', '', 'nooffset'); return; }
    const ps = pageStart.get(c[2]!);
    if (ps == null) { noJ++; push('', '', 'nopage'); return; }
    const jstart = Math.max(0, gg - ps);
    const plen = pageLen(c[2]!);
    let len = 400;
    if (lib === 'T1579') {
      const nx = rows[i + 1];
      if (nx && nx[0] === c[0] && (nx[3] === 'T' || nx[3] === 'N') && nx[5]) {
        const g2 = g.get(i + 1);
        if (g2 != null && g2 > gg && pageOf2(g2) === c[2]) len = Math.min(g2 - gg, 400);
        else if (g2 != null && g2 > gg) len = Math.min(g2 - gg, plen - jstart - 1) || len;
      }
    } else {
      len = Math.min(Math.max(4, quoteLen.get(`${c[0]}#${c[1]}`) ?? 40), 200);
    }
    const jend = Math.min(jstart + len, Math.max(jstart + 4, plen));
    if (jstart >= plen) { noJ++; push('', '', 'clip'); return; }
    withJ++;
    push(String(jstart), String(jend), c[3]!);
  });
}
function pageOf2(gGlobal: number): string {
  let best = '';
  for (const [pid, st] of pageOrder) { if (st <= gGlobal) best = pid; else break; }
  return best;
}
fs.writeFileSync('D:/2026/_scratch-ybh/spans-j.tsv', out.join('\n'), 'utf8');
console.log(`spans-j：可嵌 ${withJ}、僅聯 ${noJ}｜頁 ${pageOrder.length}、漢字 ${acc}`);
