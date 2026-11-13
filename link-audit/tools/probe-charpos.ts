#!/usr/bin/env bun
/** v14 前提驗證：anchorVa 能否吃「30p279a#40-44」形式；以及 parseCharPosition 行為。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { anchorVa } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';
import { parseCharPosition } from 'D:/2026/adb-converter/ts/src/accelon26/char-position.ts';

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
for (const q of ['30p279a', '30p279a#40-44', '30p793a#38-44']) {
  const va = await anchorVa(rd, q);
  console.log(`anchorVa(${q}) → ${va ?? 'null'}｜parseCharPosition → ${JSON.stringify(parseCharPosition('taisho?' + q))}`);
}
