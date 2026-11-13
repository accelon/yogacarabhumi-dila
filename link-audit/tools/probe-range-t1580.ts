import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { SearchSession } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const s = new SearchSession(rd);
await s.init();
const tags = rd.containers.get('tags')!;
const sVas = await rd.decodeBlockList('tags', tags.names.indexOf('書'));
const sNames = await rd.cachedStrings('書');
const pageVas = await rd.decodeBlockList('tags', tags.names.indexOf('頁'));
const ids: string[] = ((await rd.attributeValues('頁.id'))?.values ?? []).map(String);
const at0 = sNames.findIndex((n) => n.includes('瑜伽師地論'));
const lo30 = sVas[at0]!, hi30 = at0 + 1 < sVas.length ? sVas[at0 + 1]! : rd.header.maxBlockOffset;
console.log(`at0=${at0} 名="${sNames[at0]}" lo30=${lo30} hi30=${hi30}｜書數=${sVas.length}`);
for (let i = at0; i < at0 + 6 && i < sVas.length; i++) console.log(`  書[${i}] ${i + 1}. ${sNames[i]}  va=${sVas[i]}`);
function where(va: number) {
  let lo = 0, hi = sVas.length - 1, r = 0;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (sVas[m]! <= va) { r = m; lo = m + 1; } else hi = m - 1; }
  let plo = 0, phi = pageVas.length - 1, pr = -1;
  while (plo <= phi) { const m = (plo + phi) >> 1; if (pageVas[m]! <= va) { pr = m; plo = m + 1; } else phi = m - 1; }
  return `${r + 1}. ${sNames[r]} @頁 ${ids[pr]}`;
}
for (const q of ['謂有二緣故說此論', '云何瑜伽師地', '本地分中五識相應地', '將說此論先陳所為', '五識身相應地']) {
  const r = await s.search(q, 20);
  const vas = [...new Set(r.hits.map((h: { va: number }) => h.va))].slice(0, 6);
  console.log(`\n「${q}」命中 ${r.hits.length}：`);
  for (const v of vas) console.log(`   ${v}  ${where(v)}  ${v >= lo30 && v < hi30 ? '∈range' : '∉range'}`);
}
