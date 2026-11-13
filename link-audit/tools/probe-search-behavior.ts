import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd);
await s.init();
const cases = [
  '謂有二緣故說此論', '謂有二緣，故說此論', '一為如來無上法教', '謂有二緣故說此論一為如來無',
  '云何瑜伽師地', '云何瑜伽師地者', '釋曰初問云何瑜伽師地者', '初問云何瑜伽師地',
  '為平等利益安樂諸有情故', '為平等利益，安樂諸有情故', '本地分中五識相應地', '五識身相應地',
];
for (const q of cases) {
  const r = await s.search(q, 20);
  const vas = [...new Set(r.hits.map((h: { va: number }) => h.va))].slice(0, 4);
  console.log(`「${q}」 total=${r.total} 前几个 VA=${vas.join(',')}`);
}
