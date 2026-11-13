import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd);
await s.init();
const tags = rd.containers.get('tags')!;
const sVas = await rd.decodeBlockList('tags', tags.names.indexOf('書'));
const sNames = await rd.cachedStrings('書');
const at0 = sNames.findIndex((n) => n.includes('瑜伽師地論'));
const lo30 = sVas[at0]!, hi30 = sVas[at0 + 1]!;
for (const q of ['大梵問', '入楞伽', '海慧', '境瑜伽', '行瑜伽', '果瑜伽', '五教', '六門', '種姓者', '補特伽羅', '無著', '慈氏', '本地分中意地', '有尋有伺地', '三摩呬多地', '非三摩呬多地', '有心無心地', '聲聞地', '獨覺地', '菩薩地']) {
  const r = await s.search(q, 300);
  const inBook = [...new Set(r.hits.map((h: { va: number }) => h.va))].filter((v) => v >= lo30 && v < hi30);
  console.log(`「${q}」 全庫 ${inBook.length ? r.hits.length : r.hits.length}｜落 T1579 區間 ${inBook.length} 處`);
}
