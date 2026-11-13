import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
const rd = await AdbReader.open(new SyncIO('D:/2026/_scratch-ybh/ybh/ybh.adb'));
const n = rd.containers.get('source')!.count;
for (let b = 0; b < n; b++) {
  const t = await rd.sourceText(b);
  let i = t.indexOf('30p681a#227-231');
  while (i >= 0) {
    console.log(`block ${b} @${i}：[${t.slice(Math.max(0, i - 60), i + 110).replace(/\n/g, '⏎')}]`);
    i = t.indexOf('30p681a#227-231', i + 1);
  }
}
console.log('done');
