import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
const rd = await AdbReader.open(new SyncIO('D:/2026/_scratch-ybh/ybh/ybh.adb'));
const n = rd.containers.get('source')!.count;
const KEYS = ['30p490c#80-257', '30p523b#304-308', '30p579a#24-39', '30p681a#227-231', '30p694c#298-302', '30p807c#371-375'];
const lit = new Map<string, number>(), tol = new Map<string, number>();
for (let b = 0; b < n; b++) {
  const t = await rd.sourceText(b);
  if (!t.includes('所釋</聯>')) continue;
  for (const m of t.matchAll(/<聯 i="taisho\?([^"]+)">所釋<\/聯>/g)) {
    const after = t.slice(m.index + m[0].length, m.index + m[0].length + 130);
    const e = /^[\s\r\n]*<嵌 i="taisho\?([^"]+)" j="(\d+)-(\d+)" n="論文"\/>/.exec(after);
    if (!e) continue;
    const key = `${e[1]}#${e[2]}-${e[3]}`;
    if (!KEYS.includes(key)) continue;
    tol.set(key, (tol.get(key) ?? 0) + 1);
    if (after.startsWith('<嵌')) lit.set(key, (lit.get(key) ?? 0) + 1);
  }
}
for (const k of KEYS) console.log(`${k}：寬鬆 ${tol.get(k) ?? 0}｜緊貼 ${lit.get(k) ?? 0}`);
