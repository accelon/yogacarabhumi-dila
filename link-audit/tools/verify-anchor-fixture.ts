#!/usr/bin/env bun
/** fixture 自驗：把對方 §3 每條斷言在產品碼路上跑一遍（跑兩遍生成腳本另測確定性）。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { anchorVa, nodeAnchorInfo, nodeSpanText, nodeSubtreeEnd } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';
import { parseLinkSpec, isLinkTag } from 'D:/2026/adb-converter/ts/src/accelon26/link-spec.ts';

const P = 'D:/2026/yogacarabhumi-dila/link-audit/fixtures/anchor-fixture.adb';
const rd = await AdbReader.open(new SyncIO(P));
const mp = new VaPaMapper(rd); await mp.init();
let pass = 0, fail = 0;
const ok = (n: string, c: boolean, d = '') => { c ? (pass++, console.log('  ok   ' + n + (d ? '  ' + d : ''))) : (fail++, console.log('  FAIL ' + n + '  ' + d)); };
const lineAt = async (va: number | null) => (va == null ? '' : await mp.lineText(mp.edgeLine(va)));

const bare = await anchorVa(rd, 'kpD14-020');
ok('A2 裸值 kpD14-020 → 科14 行', (await lineAt(bare)).includes('<科14 n="kpD14-020">'));
const t3 = await anchorVa(rd, 'T1579#kpD03-001');
const p3 = await anchorVa(rd, 'PXJ-H#kpD03-001');
ok('A3 同值跨著作不同 VA', t3 != null && p3 != null && t3 !== p3, `${t3}/${p3}`);
ok('A3 兩者行皆 <科03 n="kpD03-001">', (await lineAt(t3)).includes('n="kpD03-001"') && (await lineAt(p3)).includes('n="kpD03-001"'));
const hook = await anchorVa(rd, 'T1579-1#kpD03-001');
ok('A6 鉤子 T1579-1#kpD03-001 命中卷1', hook != null && (await lineAt(hook)).includes('C1 問答標列'));
ok('A5 T1579-2#kpD03-001 → null', (await anchorVa(rd, 'T1579-2#kpD03-001')) == null);
const v1 = await anchorVa(rd, 'T1579-1#kpD01-001');
const v4 = await anchorVa(rd, 'T1579-4#kpD01-001');
const v21 = await anchorVa(rd, 'T1579-21#kpD01-001');
ok('A5 三卷 VA 遞增', v1 != null && v1 < v4! && v4! < v21!, `${v1}/${v4}/${v21}`);
const pianLast = await anchorVa(rd, 'T1579#kpD01-001');
ok('A5 篇級取最後一筆＝-21', pianLast === v21, `${pianLast}`);
const span = await nodeSpanText(rd, t3!, (await nodeAnchorInfo(rd, 'T1579#kpD03-001'))!.vaEnd);
ok('A4 交叉引字面在 span 內', span.includes('〔T1580-1#kpD04-003〕'));
const n1 = await nodeAnchorInfo(rd, 'T1579-1#kpD01-001');
const se = await nodeSubtreeEnd(rd, n1!.va);
const subTxt = await nodeSpanText(rd, n1!.va, se, 500);
ok('B7 子樹含「五識身相應地」', subTxt.includes('五識身相應地'));
ok('B8 子樹不跨卷2', !subTxt.includes('卷第2'), `界=${se}`);
const tiers = (subTxt.match(/<科\d\d/g) ?? []).length;
ok('B7 子樹科判行 ≥4', tiers >= 4, 'tiers=' + tiers);
const n4 = await nodeAnchorInfo(rd, 'T1579-1#kpD04-001');
const se4 = await nodeSubtreeEnd(rd, n4!.va);
ok('B9 葉界＝同層下一兄弟', se4 === n4!.vaEnd || se4 > n4!.va, `${n4!.va}→${se4}`);
ok('B10 節聯 parseLinkSpec', isLinkTag('節聯') && parseLinkSpec('節聯', (a) => (a === 'n' ? 'T1579-1#kpD02-002' : ''))?.kind === 'node');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
