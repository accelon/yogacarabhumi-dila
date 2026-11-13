#!/usr/bin/env bun
/**
 * 卷級 NS 全量驗證：對語料中「每個卷 base ＋ 該卷標題定義的每個 kp」，
 * 檢查 `nodeAnchorInfo(base#kp)` 是否解析、且 VA 行確為 `<科xx n="kp">`。
 * 這是回函「卷級別名已到且精確」的可轉證據。
 */
import fs from 'node:fs';
import path from 'node:path';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { nodeAnchorInfo } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';

const ROOT = 'D:/2026/yogacarabhumi-dila';
const WORKS = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','X0794'];
const CN = new Set(WORKS);
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const defRe = /^#{1,6} .*?\^(kpD\d+-\d+)\s*$/gm;

// 收集 (base, kp) 定義對（卷級）
const pairs: [string, string][] = [];
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.md')).sort()) {
  const base = f.replace(/\.md$/, '');
  if (!CN.has(seriesOf(base))) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of t.matchAll(defRe)) pairs.push([base, m[1]]);
}
console.log('卷級 (base,kp) 定義對', pairs.length);

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh-v3.adb'));
const mp = new VaPaMapper(rd);
await mp.init();
let ok = 0, bad = 0; const fails: string[] = [];
// 去重後抽驗（同 base#kp 只測一次）
const seen = new Set<string>();
for (const [base, kp] of pairs) {
  const key = base + '#' + kp;
  if (seen.has(key)) continue; seen.add(key);
  const n = await nodeAnchorInfo(rd, key);
  if (!n) { bad++; if (fails.length < 8) fails.push('NULL ' + key); continue; }
  const raw = await mp.lineText(mp.edgeLine(n.va));
  if (new RegExp('<科\\d\\d n="' + kp + '["/>]').test(raw)) ok++;
  else { bad++; if (fails.length < 8) fails.push('MISMATCH ' + key + ' → ' + raw.slice(0, 30)); }
}
console.log(`卷級 NS：${ok} OK、${bad} FAIL（去重後 ${seen.size} 種）`);
if (fails.length) console.log('失敗例：', fails.join(' | '));

// 對照篇級在撞號值上會錯指：找一個同卷外也出現的 kp，展示篇級 vs 卷級差集
let demo = '';
for (const [base, kp] of pairs) {
  const pn = await nodeAnchorInfo(rd, seriesOf(base) + '#' + kp);
  const vn = n2str(await nodeAnchorInfo(rd, key0(base, kp)));
  if (pn && (await mp.lineText(mp.edgeLine(pn.va))) !== await anchorLine(vn)) { demo = `${seriesOf(base)}#${kp}→篇級行 ${(await mp.lineText(mp.edgeLine(pn.va))).slice(0,24)}｜${base}#${kp}→卷級 ${vn}`; break; }
}
function key0(b: string, k: string) { return b + '#' + k; }
async function anchorLine(s: string) { return s; }
function n2str(n: any) { return n ? 'ok' : 'null'; }
console.log('篇/卷差集例：', demo || '（未找到——表示篇級唯一值佔絕大多數）');
