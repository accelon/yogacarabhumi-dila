/** v23 融視圖落地檢查：標籤表、枚數、成對性、以及抽樣填入（headless 版 V6）。 */
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { nodeAnchorInfo, nodeSubtreeEnd, nodeSpanText } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';
const rd = await AdbReader.open(new SyncIO(process.argv[2] ?? 'D:/2026/_scratch-ybh/ybh/ybh.adb'));
const tags = rd.containers.get('tags')!;
console.log('標籤表含「融」：', tags.names.includes('融') || tags.names.includes('_融'), '（reader 靠這個決定開關是否渲染）');
const parts: string[] = [];
for (let b = 0; b < rd.containers.get('source')!.count; b++) parts.push(await rd.sourceText(b));
const whole = parts.join('');
const paired = [...whole.matchAll(/<融 i="([^"]+)"[^>]*><\/融>/g)];
const selfClose = [...whole.matchAll(/<融 [^>]*\/>/g)];
const orphanOpen = (whole.match(/<融 /g) ?? []).length;
console.log(`<融> 枚數：成對空殼 ${paired.length}｜自閉合寫法 ${selfClose.length}（必須 0）｜開標記總數 ${orphanOpen}`);
const per: Record<string, number> = {};
for (const m of paired) { const k = m[1]!.split('#')[0]!.split('-')[0]!; per[k] = (per[k] ?? 0) + 1; }
console.log('目標卷分佈（前 10）：', Object.entries(per).slice(0, 10).map(([k, v]) => `${k}:${v}`).join(' '));
let fillOk = 0; const fails: string[] = [];
for (const m of paired.slice(0, 250)) {
  const anchor = m[1]!.slice(m[1]!.indexOf('?') + 1);
  const info = await nodeAnchorInfo(rd, anchor);
  if (!info) { fails.push(anchor + ' 解析失敗'); continue; }
  const end = (await nodeSubtreeEnd(rd, info.va)) ?? info.vaEnd;
  const s = await nodeSpanText(rd, info.va, end, 24);
  if (s.length >= 20) fillOk++;
  else fails.push(anchor + ` 填入過短(${s.length})`);
}
console.log(`抽樣 250 枚 headless 填入（等同 fusion-view fillOne 的取段路徑）：可填 ${fillOk}、異常 ${fails.length}`);
if (fails.length) console.log('異常樣本：' + fails.slice(0, 4).join('；'));
console.log(paired.length > 0 && selfClose.length === 0 && fails.length === 0 ? 'PASS' : 'CHECK');
