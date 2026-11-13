#!/usr/bin/env bun
/**
 * make-anchor-fixture.ts — 最小固定 anchor fixture（回 prompt-ybh-anchor-fixture.md）
 * 產出 link-audit/fixtures/anchor-fixture.adb：authorAdb 無時間戳 → 逐位元組確定。
 * 節點表嚴格按對方 §3；每條對應 anchor-node.test.ts 的斷言。
 */
import { authorAdb } from 'D:/2026/adb-converter/ts/src/adbauthor.ts';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const KE = Array.from({ length: 14 }, (_, i) => '科' + String(i + 1).padStart(2, '0')).join(',');
const lines: string[] = [];
lines.push('<集 t="集">錨點固定樣本</集>');
lines.push(`<隱><樹 s="*" l="註,釋" t="篇,章,${KE}.">目錄</樹></隱>`);
// ── 篇 T1579 ──
lines.push('<篇 id="T1579" t="章">瑜伽師地論（T1579）</篇>');
lines.push(`<章 id="T1579-1" t="${KE}">卷第1</章>`);
// B#7：kpD01-001 下 ≥4 層嵌套子科，最深含「五識身相應地」
lines.push('<科01 n="kpD01-001">本地分</科01>');
lines.push('<科02 n="kpD02-001">B1 五識身相應地</科02>');
lines.push('<科03 n="kpD03-001">C1 問答標列十七地名</科03>');
// A#4：科03 其下交叉引一行含字面〔T1580-1#kpD04-003〕（nodeSpanText 斷言）
lines.push('《略纂》〔T1580-1#kpD04-003〕');
// B#9：葉 kpD04-001 的同層下一兄弟緊接在後（subtreeEnd＝首筆界）
lines.push('<科04 n="kpD04-001">D1 問</科04>');
lines.push('云何瑜伽師地。');
lines.push('<科04 n="kpD04-002">D2 答</科04>');
lines.push('謂十七地。');
lines.push('<科02 n="kpD02-002">B2 別廣地攝</科02>');
// A#2：bare kpD14-020 文件序第一筆即此
lines.push('<科14 n="kpD14-020">N2 明其中可得諸法</科14>');
// B#10：節聯冒煙（指向本卷實存 kpD02-002）
lines.push('詳<節聯 n="T1579-1#kpD02-002">別廣地攝</節聯>下文。');
lines.push(`<章 id="T1579-2" t="${KE}">卷第2</章>`);
// A#5：T1579-2 無 kpD01-001、無 kpD03-001（卷級查無→null 斷言）
lines.push('<科05 n="kpD05-001">E1 嗢柁南</科05>');
lines.push('<科05 n="kpD05-002">E2 長行</科05>');
lines.push(`<章 id="T1579-4" t="${KE}">卷第4</章>`);
lines.push('<科01 n="kpD01-001">本地分（卷四）</科01>');
lines.push(`<章 id="T1579-21" t="${KE}">卷第21</章>`);
// kpD01-001 三卷 VA 遞增、-21 最大（篇級取最後一筆斷言）
lines.push('<科01 n="kpD01-001">本地分（卷廿一）</科01>');
// ── 篇 PXJ-H ──
lines.push('<篇 id="PXJ-H" t="章">披尋記（PXJ-H）</篇>');
lines.push(`<章 id="PXJ-H-1" t="${KE}">卷第1</章>`);
// A#3：kpD03-001 同值跨著作、不同 VA
lines.push('<科03 n="kpD03-001">丙一、徵</科03>');
lines.push('云何瑜伽師地。');

const res = await authorAdb({ dbname: 'anchorfix', dbcname: '錨點固定樣本', lines, dropNumeric: true });
fs.mkdirSync('D:/2026/yogacarabhumi-dila/link-audit/fixtures', { recursive: true });
const out = 'D:/2026/yogacarabhumi-dila/link-audit/fixtures/anchor-fixture.adb';
fs.writeFileSync(out, res.file);
console.log(`寫入 ${out}：${res.file.length} bytes，${res.lines} 行`);
console.log('sha256', createHash('sha256').update(res.file).digest('hex'));
