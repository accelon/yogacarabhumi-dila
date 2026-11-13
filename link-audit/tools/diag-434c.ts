#!/usr/bin/env bun
/** 診斷 30p434c：我的掃描頁長 vs pageHanTextOf 頁長；下一標記是谁、在哪。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { pageHanTextOf, anchorVa, blockOf, anchorIndex } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const mp = new VaPaMapper(rd); await mp.init();
const han = await pageHanTextOf(rd, '30p434c');
console.log('pageHanTextOf 長 =', han.length, '｜尾 12 字 =', han.slice(-12));

const idx = await anchorIndex(rd);
const va = (await anchorVa(rd, '30p434c'))!;
const blk = blockOf(idx!, va);
let text = '';
for (let b = blk; b <= blk + 4 && b < idx!.bv.length; b++) text += await rd.sourceText(b);
const k = text.indexOf('<頁 id="30p434c"');
const rest = text.slice(k);
const marks = [...rest.matchAll(/<頁[^>]*>/g)].slice(0, 3).map((m) => `${m.index}:${m[0]}`);
console.log('原始相鄰標記:', marks.join('  '));
const L = mp.edgeLine(va);
console.log('va 所在行', L, '行內容:', (await mp.lineText(L)).slice(0, 80));
// 掃描視角：行 434c 標記到下一標記之間的漢字
let acc = 0, seen = false;
for (let i = L; i < L + 30; i++) {
  const raw = await mp.lineText(i);
  if (seen && raw.includes('<頁')) { console.log('掃描下一標記在行', i, raw.slice(raw.indexOf('<頁'), raw.indexOf('<頁') + 30)); break; }
  if (raw.includes('30p434c')) seen = true;
  acc += (raw.replace(/<[^>]*>/g, '').match(/\p{Script=Han}/gu) ?? []).length;
}
console.log('掃描視角 434c→下一標記 漢字 ≈', acc);
