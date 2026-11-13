#!/usr/bin/env bun
/** v5 前提驗證：authorAdb 寫入 <節聯>／<嵌 sub> 後，讀端行文字原樣往返、標籤進 tags 容器。 */
import { authorAdb } from 'D:/2026/adb-converter/ts/src/adbauthor.ts';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { nodeAnchorInfo } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';
import { writeFileSync } from 'node:fs';

const lines = [
  '<集 t="集">微型</集>',
  '<隱><樹 s="*" t="篇,章,科01,科02.">目錄</樹></隱>',
  '<篇 id="W1" t="章">論甲（W1）</篇>',
  '<章 id="W1-1">卷第1</章>',
  '<科01 n="kpD01-001">大科</科01>',
  '<科02 n="kpD02-001">子科一</科02>子科文字甲。',
  '<科02 n="kpD02-002">子科二</科02>子科文字乙。',
  '<章 id="W1-2">卷第2</章>',
  '<科01 n="kpD01-001">大科第二卷</科01>另有文字。',
  '詳見<節聯 n="W1-1#kpD02-002">子科二</節聯>與<嵌 i="mini?W1-1#kpD01-001" n="整科" sub="1" max="5000"/>。',
];
const res = await authorAdb({ dbname: 'mini', dbcname: '微型', lines });
writeFileSync('D:/2026/_scratch-ybh/mini-v5.adb', res.file);
const rd = await AdbReader.open(new SyncIO('D:/2026/_scratch-ybh/mini-v5.adb'));
const mp = new VaPaMapper(rd); await mp.init();
const lastLine = await mp.lineText(lines.length - 1);
console.log('往返行：', lastLine);
const keep = lastLine.includes('<節聯 n="W1-1#kpD02-002">') && lastLine.includes('sub="1"') && lastLine.includes('</節聯>');
console.log('節聯/嵌 sub 原樣往返:', keep ? 'OK' : 'FAIL');
const tags = rd.containers.get('tags')?.names ?? [];
console.log('tags 含 節聯/嵌/嵌close:', tags.includes('節聯'), tags.includes('嵌'), '(嵌 close:', tags.includes('/嵌'), ')');
// 卷級錨＋子樹界在微型库也成立
const n = await nodeAnchorInfo(rd, 'W1-1#kpD01-001');
console.log('W1-1#kpD01-001 →', n?.va, 'vaEnd', n?.vaEnd);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const anyMod: any = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const se = await anyMod.nodeSubtreeEnd(rd, n!.va);
const txt = await anyMod.nodeSpanText(rd, n!.va, se, 5000);
console.log('sub 界 →', se, '｜子樹含子科二:', txt.includes('子科二'), '｜不跨卷2:', !txt.includes('大科第二卷'));
