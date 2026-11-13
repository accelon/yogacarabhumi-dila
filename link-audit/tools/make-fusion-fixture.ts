#!/usr/bin/env bun
/**
 * make-fusion-fixture.ts — P4 融視圖的凍結樣本（可執行規格，不動 anchor-fixture.adb）
 * 語境：科文樹（KE 韓科、JI 基科）以 <融 i="fix?GW-1#kp…"> 指向同一段論本（GW），
 * 論本只存一份（standoff）；含缺目標回退樣本與子樹 span 樣本。
 */
import { authorAdb } from 'D:/2026/adb-converter/ts/src/adbauthor.ts';
import { createHash } from 'node:crypto';
import fs from 'node:fs';

const T = '科01,科02,科03,科04';
const lines: string[] = [];
lines.push('<集 t="集">融合視圖樣本</集>');
lines.push(`<隱><樹 s="*" t="篇,章,${T}.">目錄</樹></隱>`);
// ── 論本（唯一一份原文）──
lines.push('<篇 id="GW" t="章">論本（GW）</篇>');
lines.push(`<章 id="GW-1" t="${T}">卷第1</章>`);
lines.push('<科01 n="kpD01-001">本地分</科01>');
lines.push('<科02 n="kpD02-001">五識身相應地</科02>');
lines.push('<科03 n="kpD03-001">問答標列</科03>');
lines.push('<科04 n="kpD04-001">問</科04>');
lines.push('云何瑜伽師地。謂十七地。');
lines.push('<科04 n="kpD04-002">答</科04>');
lines.push('謂十七地者。云何為十七。');
lines.push('<科02 n="kpD02-002">意地</科02>');
lines.push('云何意地。謂心意識。');
// ── 科文樹一：韓科 ──
lines.push('<篇 id="KE" t="章">韓科（KE）</篇>');
lines.push(`<章 id="KE-1" t="${T}">卷第1</章>`);
lines.push('<科01 n="ke-a">本地分</科01>');
lines.push('<融 i="fix?GW-1#kpD01-001" n="原文・本地分">（融視圖開啟時填入論本）</融>');
lines.push('<科02 n="ke-b">五識身</科02>');
lines.push('<融 i="fix?GW-1#kpD02-001" n="原文・五識">（填入）</融>');
lines.push('<科02 n="ke-c">失鏈示例</科02>');
lines.push('<融 i="fix?GW-1#kpD02-999" n="缺目標">（此段應保留佔位並提示，不得空白）</融>');
// ── 科文樹二：基科（與韓科指向同一論本節點 → standoff 斷言）──
lines.push('<篇 id="JI" t="章">基科（JI）</篇>');
lines.push(`<章 id="JI-1" t="${T}">卷第1</章>`);
lines.push('<科01 n="ji-a">本地分</科01>');
lines.push('<融 i="fix?GW-1#kpD01-001" n="原文・本地分">（與 ke-a 同目標）</融>');

const res = await authorAdb({ dbname: 'fix', dbcname: '融合視圖樣本', lines, dropNumeric: true });
const out = 'D:/2026/yogacarabhumi-dila/link-audit/fixtures/fusion-fixture.adb';
fs.writeFileSync(out, res.file);
console.log(`寫入 ${out}：${res.file.length} bytes，${res.lines} 行`);
console.log('sha256', createHash('sha256').update(res.file).digest('hex'));
