#!/usr/bin/env bun
/**
 * 一條命令跑完整驗收（v21 起取代四支腳本手跑）。
 *
 * 用法：bun verify-all.ts [adb 路徑] [版號標籤]
 *   預設 D:/accelon3/ybh.adb、標籤＝日期時間。輸出 link-audit/data/verify-<標籤>.txt，
 *   終端只列小節結果與最終 PASS／CHECK。
 *
 * 五節：
 *   ① 本體：大小／SHA-256／源碼區塊數。
 *   ② 庫內錨點：所有 <節聯 n> 與 <嵌 i="ybh?"> 目標逐一经 nodeAnchorInfo 解析（含正負控：
 *      卷級 NS 已到、篇級 last ≠ 卷級 first）。
 *   ③ 跨庫：所有 <聯 i="taisho?…"> 座標形式必须在 taisho.adb 解析得到 VA。
 *   ④ 段落 ref：擑給 verify-zhu-refs.ts（由 adb 位元組回讀逐條 renderEmbed）。
 *   ⑤ 樹回歸：擑給 verify-v15.ts ＋ probe-outline-tabs.ts（UI 同碼路 loadTrees→loadTree→buildTree）。
 * 不重複實作既有判定——能組合就不另寫，避免兩套標準各自漂移。
 */
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const YBH = process.argv.slice(2).find((x) => !x.startsWith('--')) ?? 'D:/accelon3/ybh.adb';
const nowD = new Date();
const pad = (x: number) => String(x).padStart(2, '0');
const TAG = process.argv.slice(3).find((x) => !x.startsWith('--'))
  ?? `${nowD.getFullYear()}-${pad(nowD.getMonth() + 1)}-${pad(nowD.getDate())}_${pad(nowD.getHours())}${pad(nowD.getMinutes())}`;   // 用本地時間，UTC 會差 8 小時易誤判新舊
const FAST = process.argv.includes('--fast');              // 快速自測：只跑 ①②③，不委派子腳本
const SCR = 'D:/2026/_scratch-ybh';
const OUT = `D:/2026/yogacarabhumi-dila/link-audit/data/verify-${TAG}.txt`;
const log: string[] = [];
let verdict = 0;                                        // 未綠項計數：任一節 FAIL 都不能報 PASS
const say = (s: string) => { log.push(s); console.log(s); };

const buf = fs.readFileSync(YBH);
say(`# verify-all  ${new Date().toString()}`);
say(`本體 ${YBH}`);
say(`  ${(buf.length / 1048576).toFixed(2)} MiB  sha256 ${crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)}…`);

const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { nodeAnchorInfo, anchorVa } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const rd = await AdbReader.open(new SyncIO(YBH));
say(`  源碼區塊 ${rd.containers.get('source')!.count}`);

// 整庫串接：**區塊間不可插分隔符**——寫入器本來就不留行界，ref 行也可能被切在兩個 block 邊界，
// 插 '\n' 會把跨界的座標字串截斷（實測 46 條被誤判 FAIL）。
const parts: string[] = [];
for (let b = 0; b < rd.containers.get('source')!.count; b++) parts.push(await rd.sourceText(b));
const whole = parts.join('');

// ② 庫內錨點
{
  const t0 = Date.now();
  const targets = new Set<string>();
  for (const m of whole.matchAll(/<節聯 n="([^"]+)"/g)) targets.add(m[1]!);
  for (const m of whole.matchAll(/<嵌 i="ybh\?([^"]+)"/g)) targets.add(m[1]!);
  let ok = 0; const bad: string[] = [];
  for (const t of targets) { const info = await nodeAnchorInfo(rd, t); if (info) ok++; else if (bad.length < 5) bad.push(t); }
  const neg = await nodeAnchorInfo(rd, 'T1579-1#kpD03-001');       // 卷級：應精確落在卷一
  const pLast = await nodeAnchorInfo(rd, 'T1579#kpD01-001');        // 篇級：語義＝最後一筆
  const vFirst = await nodeAnchorInfo(rd, 'T1579-1#kpD01-001');
  const semOk = (pLast?.va ?? -1) !== (vFirst?.va ?? -2);
  say(`② 庫內錨點：${targets.size} 種目標 → 解析 OK ${ok}、FAIL ${targets.size - ok}${bad.length ? '｜樣本 ' + bad.join(' ') : ''}`);
  say(`   語義控：卷級落點 ${neg ? 'OK' : 'FAIL'}｜篇級≠卷級首筆 ${semOk ? 'OK' : 'FAIL'}`);
  if (targets.size - ok > 0 || !neg || !semOk) { verdict++; say('   ⚠ 庫內錨點有 FAIL'); }
  say(`   (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

// ③ 跨庫
{
  const t0 = Date.now();
  const pages = new Set<string>();
  for (const m of whole.matchAll(/<聯 i="taisho\?([^"]+)"/g)) pages.add(m[1]!);
  const trd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
  let ok = 0; const bad: string[] = [];
  for (const p of pages) { if (await anchorVa(trd, p) != null) ok++; else if (bad.length < 5) bad.push(p); }
  say(`③ 跨庫 taisho：${pages.size} 種座標形式 → 解析 OK ${ok}、FAIL ${pages.size - ok}${bad.length ? '｜樣本 ' + bad.join(' ') : ''}｜(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
  if (pages.size - ok > 0) { verdict++; say('   ⚠ 跨庫有 FAIL'); }
}

// ④⑤ 組合既有腳本（同一標準，不另寫一套）；--fast 只跑本檔的 ①②③，用於改腳本時的快速自測
// 判定不靠「有沒有印 PASS」：④ 自身會報 PASS，⑤a/⑤b 是診斷清單（不印 PASS），
// 所以 ⑤ 改用**期望值正則**斷言——漂移時（頁籤數、節點數、鏡像父層子女數變動）會被當成未綠。
if (!FAST) {
  for (const [name, args, want] of [
    ['④ 段落 ref（adb 位元組回讀＋renderEmbed）', ['verify-zhu-refs.ts', YBH], /PASS/],
    ['⑤a 樹回歸（總目錄 17 根／377 節／卷級錨落點）', ['verify-v15.ts'], /根=17（期望17）總節點=377（期望377）/],
    ['⑤b 樹回歸（35 頁籤・科大漢父層）', ['probe-outline-tabs.ts'], /樹總數 35[\s\S]*子女=2/],
  ] as [string, string[], RegExp][]) {
    const t0 = Date.now();
    let out = '', crashed = false;
    try {
      out = execFileSync('bun', args, { cwd: SCR, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 1_500_000 });
    } catch (e: any) { out = String(e?.stdout ?? '') + String(e?.stderr ?? e?.message ?? ''); crashed = true; }
    const body = out.trim().split('\n');
    const green = want.test(out) && !crashed;
    say(`${name}：${green ? '綠' : crashed ? '子腳本異常' : '未綠'}｜${(body[0] ?? '').slice(0, 112)}｜(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    log.push(...body.map((l) => '    ' + l));
    if (!green) verdict++;
  }
}
say(`=== 判定 ${verdict === 0 ? 'PASS' : 'CHECK（' + verdict + ' 項未綠）'}`);
fs.writeFileSync(OUT, log.join('\n') + '\n', 'utf8');
console.log(`→ ${OUT}`);
process.exit(verdict === 0 ? 0 : 1);
