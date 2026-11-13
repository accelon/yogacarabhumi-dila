#!/usr/bin/env bun
/** 活體驗收：卷級 NS 別名在 ybh-v3.adb 上的真行爲（含首/尾語義與邊角）。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { nodeAnchorInfo } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/ybh-v3.adb'));
const mp = new VaPaMapper(rd);
await mp.init();
const line = async (va: number | undefined) => {
  if (va == null) return 'null';
  const raw = await mp.lineText(mp.edgeLine(va));
  return `${va}｜${raw.slice(0, 46).replace(/\s+/g, ' ')}`;
};
const probe = async (a: string) => {
  const n = await nodeAnchorInfo(rd, a);
  console.log(`${a.padEnd(26)} → ${n ? await line(n.va) : 'null'}`);
};
await probe('T1579-1#kpD03-001');    // 卷級：應=T1579-1 的 C1
await probe('T1579#kpD03-001');      // 篇級唯一值：應=T1579-1 的 C1（first==last）
await probe('T1579#kpD01-002');      // 篇級撞號值（7 卷）：spec=最後一筆
await probe('T1579-1#kpD01-002');    // 卷級同一值：應=T1579-1 內那一筆
await probe('T1579-53#kpD01-002');   // 卷級指另一筆
await probe('T1602-13#kpD08-073');   // 真撞號例的第二卷
await probe('kpD01-002');            // 裸值：文件序第一筆
await probe('T1579-1#kpD99-999');    // 卷級查無：应 null、不退篇級
await probe('99p0#x');               // 亂值：null
