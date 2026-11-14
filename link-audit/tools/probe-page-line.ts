import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { anchorVa } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const mp = new VaPaMapper(rd); await mp.init();
for (const p of ['30p279a', '30p279b', '30p424a']) {
  const va = await anchorVa(rd, p);
  const line = mp.edgeLine(va!);
  const txt = await mp.lineText(line);
  console.log(`${p}：va=${va} adb line=${line} 该行=${JSON.stringify(txt.slice(0, 60))}`);
}
