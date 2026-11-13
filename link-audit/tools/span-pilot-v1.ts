#!/usr/bin/env bun
/**
 * P0 試點（draft-kemon-gen-zhu §6）：本地分第一卷 T1579-1.md
 * 每個 kpD 科判 → 其下原文起句 → 用 AdbEngine 在 taisho.adb **檢索**（不抽全文）
 * → 命中 VA 解析成最近 頁.id（頁欄）→ 統計唯一命中 / 多命中 / 0 命中 + 頁欄單調性。
 */
import fs from 'node:fs';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const md = fs.readFileSync('D:/2026/yogacarabhumi-dila/T1579-1.md', 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');

// 起句：去掉《…》參考行、腳註、括注拉丁、標點，取前 K 個漢字
const K = 10;
function opening(text: string): string {
  let t = text
    .replace(/《\[\[[^\]]*\]\]》/g, '')
    .replace(/\[\^[^\]]+\]/g, '')
    .replace(/（[^）]*[A-Za-zā-ūṃ][^）]*）/g, '')
    .replace(/[「」『』“”‘’\s\u3000、。，：；！？·—…-]/g, '');
  return [...t].filter((c) => /[\u4e00-\u9fff]/.test(c)).slice(0, K).join('');
}

type Item = { kp: string; heading: string; phrase: string };
const items: Item[] = [];
let pending: { kp: string; heading: string } | null = null;
for (const ln of md) {
  const h = /^#{1,6}\s+(.*?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln);
  if (h) { pending = { kp: h[2], heading: h[1].replace(/^[A-Z]\d*\s*/, '') }; continue; }
  if (!pending) continue;
  const t = ln.trim();
  if (!t || /^《/.test(t)) continue; // 空行／書目參考行
  const ph = opening(t);
  if (ph.length >= 4) items.push({ ...pending, phrase: ph });
  pending = null;
}
console.log('樣本：T1579-1.md 取到', items.length, '個「科判→起句」對');

// taisho.adb：頁標籤 VA 表＋頁 id，做 VA→頁欄 解析
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd);
await s.init();
const tags = rd.containers.get('tags')!;
const pi = tags.names.indexOf('頁');
if (pi < 0) throw new Error('taisho 沒有 頁 標籤');
const pageVas = await rd.decodeBlockList('tags', pi);
const pageIds = await rd.cachedStrings('頁').catch(() => null);
const av = await rd.attributeValues('頁.id').catch(() => null);
const ids: string[] = (pageIds && pageIds.length === pageVas.length ? pageIds : null)
  ? pageIds!
  : (av?.values ?? []).map(String);
if (ids.length !== pageVas.length) console.log('⚠ 頁 id 與 VA 數不符：', ids.length, 'vs', pageVas.length);
function pageOf(va: number): string {
  let lo = 0, hi = pageVas.length - 1, at = -1;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (pageVas[m]! <= va) { at = m; lo = m + 1; } else hi = m - 1; }
  return at < 0 ? '' : ids[at] ?? '';
}

let uniq = 0, multi = 0, zero = 0, out30 = 0;
const rows: string[] = [];
let prev = -1, mono = 0, regress = 0;
for (const it of items) {
  const res = await s.search(it.phrase, 200);
  const vas = [...new Set(res.hits.map((h: { va: number }) => h.va))].sort((a, b) => a - b);
  const pages = [...new Set(vas.map(pageOf).filter(Boolean))];
  const in30 = pages.filter((p: string) => p.startsWith('30p'));
  if (!vas.length) { zero++; rows.push(`0\t${it.kp}\t${it.phrase}`); continue; }
  if (vas.length === 1) uniq++; else multi++;
  if (!in30.length) out30++;
  const pick = in30[0] ?? pages[0] ?? '';
  const num = /30p(\d+)/.exec(pick)?.[1] ? +/30p(\d+)/.exec(pick)![1]! : NaN;
  if (!Number.isNaN(num)) { if (num >= prev) mono++; else regress++; prev = Math.max(prev, num); }
  rows.push(`${vas.length}\t${it.kp}\t${it.phrase}\t${pick}${in30.length ? '' : '⚠非冊30'}\t${pages.slice(0, 4).join(',').slice(0, 60)}`);
}
console.log(`總計 ${items.length}：唯一 ${uniq}、多重 ${multi}、零 ${zero}（其中命中但不在冊30 ${out30}）`);
console.log(`頁欄單調性：不下降 ${mono}、倒退 ${regress}`);
fs.writeFileSync('D:/2026/_scratch-ybh/span-pilot-T1579-1.tsv', ['n\tkp\tphrase\tpage\tpages', ...rows].join('\n'));
console.log('明細 → _scratch-ybh/span-pilot-T1579-1.tsv');
