import fs from 'node:fs';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { nodeAnchorInfo, nodeSubtreeEnd, nodeSpanText } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';
const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh.adb'));
const keys: string[] = [];
for (const f of fs.readdirSync('.').filter((x) => /^zhu-spans-.+\.json$/.test(x))) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8')) as { nodeKey: string; mode: string }[];
  const own = j.filter((r) => r.nodeKey && r.mode !== 'K');       // 細對齊者才發融（K 繼承太粗）
  const step = Math.max(1, Math.floor(own.length / 60));
  for (let i = 0; i < own.length; i += step) keys.push(own[i]!.nodeKey);
}
console.log('抽樣目標', keys.length, '條');
const buckets: Record<string, number> = {};
const samples: string[] = [];
let i = 0;
for (const k of keys) {
  const info = await nodeAnchorInfo(rd, k);
  if (!info) { buckets['解析失敗'] = (buckets['解析失敗'] ?? 0) + 1; continue; }
  const end = await nodeSubtreeEnd(rd, info.va) ?? info.vaEnd;
  const s = await nodeSpanText(rd, info.va, end, 24);              // 候選 max=24 行
  const n = s.length;
  const b = n < 100 ? '<100' : n < 300 ? '100-300' : n < 600 ? '300-600' : n < 1200 ? '600-1200' : '>1200';
  buckets[b] = (buckets[b] ?? 0) + 1;
  if (i++ < 3) samples.push(k + ' → ' + n + ' 字「' + s.replace(/\n/g, '⏎').slice(0, 40) + '」');
}
console.log('max=24 行的填字數分佈：', buckets);
console.log(samples.join('\n'));
