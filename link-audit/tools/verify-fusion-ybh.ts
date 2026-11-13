#!/usr/bin/env bun
/**
 * 融視圖落地檢查（v2＝headless 版 V6／V7 的資料端等價，本輪補上渲染器層）。
 *
 * 四段：
 *  ① 標籤表含「融」——reader `hasFusionTag()` 靠這個決定開關要不要渲染（沒有就是死 UI）。
 *  ② adb 位元組層：枚數、成對性（自閉合必須 0）。
 *  ③ 取段能力：抽樣走 `nodeAnchorInfo → nodeSubtreeEnd → nodeSpanText(max=24)`，
 *     與 fusion-view `fillOne` 同一條碼路，證明「開關一開就填得出東西」。
 *  ④ **渲染器層（本輪新增）**：拿實際入庫的那些行過 `Accelon3Renderer.line()`，
 *     `accelon26.fusionView` 先 0 後 1——OFF 必須零輸出且不吐游離 span；
 *     ON 必須出 `.fusionBlock` 殼、`data-i` 對得上、span 開閉配對、周圍正文不被吃掉；
 *     再補一筆假錨（V7 等價）確認不會炸、旁邊文字仍在。
 *     ＝補掉「只驗字串存在、沒驗渲染結果」這個漏洞。
 *
 * 用法：bun verify-fusion-ybh.ts [adb 路徑] [ybh.xml 路徑]
 */
import fs from 'node:fs';
const store = new Map<string, string>();
const el = () => ({ style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, after() {}, insertBefore() {} });
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' }; g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };
g.CSS = { highlights: new Map() };

const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { nodeAnchorInfo, nodeSubtreeEnd, nodeSpanText } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const { Accelon3Renderer } = await import('D:/2026/adb-converter/ts/src/accelon26/render_accelon3.ts');

const YBH = process.argv[2] ?? 'D:/accelon3/ybh.adb';
const XML = process.argv[3] ?? 'D:/2026/_scratch-ybh/ybh/ybh.xml';
let bad = 0;
const rd = await AdbReader.open(new SyncIO(YBH));
const tags = rd.containers.get('tags')!;
const hasRong = tags.names.includes('融') || tags.names.includes('_融');
console.log(`① 標籤表含「融」：${hasRong}（false 則 reader 不會渲染開關）`);
if (!hasRong) bad++;

const parts: string[] = [];
for (let b = 0; b < rd.containers.get('source')!.count; b++) parts.push(await rd.sourceText(b));
const whole = parts.join('');
const paired = [...whole.matchAll(/<融 i="([^"]+)"[^>]*><\/融>/g)];
const selfClose = [...whole.matchAll(/<融 [^>]*\/>/g)];
console.log(`② adb 位元組：<融> ${paired.length} 枚成對空殼｜自閉合 ${selfClose.length}（必須 0）`);
if (paired.length === 0 || selfClose.length > 0) bad++;

let fillOk = 0; const fails: string[] = [];
for (const m of paired.slice(0, 250)) {
  const anchor = m[1]!.slice(m[1]!.indexOf('?') + 1);
  const info = await nodeAnchorInfo(rd, anchor);
  if (!info) { fails.push(anchor + ' 解析失敗'); continue; }
  const end = (await nodeSubtreeEnd(rd, info.va)) ?? info.vaEnd;
  const s = await nodeSpanText(rd, info.va, end, 24);
  if (s.length >= 20) fillOk++; else fails.push(anchor + ` 填入過短(${s.length})`);
}
console.log(`③ 抽樣 250 枚取段（同 fillOne 路徑）：可填 ${fillOk}、異常 ${fails.length}`);
if (fails.length) { console.log('   ' + fails.slice(0, 3).join('；')); bad++; }

const rawLines = fs.existsSync(XML) ? fs.readFileSync(XML, 'utf8').split('\n') : [];
const fusionLines = rawLines.filter((l) => l.includes('<融 '));
if (!fusionLines.length) console.log('④ 找不到 ybh.xml 樣本行（先跑 build-ybh）→ 跳過渲染器層');
else {
  const step = Math.max(1, Math.floor(fusionLines.length / 40));
  const picks: string[] = [];
  for (let i = 0; i < fusionLines.length && picks.length < 40; i += step) picks.push(fusionLines[i]!);
  const depth = new Map<string, number>();
  const render = (l: string) => new Accelon3Renderer({ depthOf: depth, levels: 0 } as any).line(l, 1);
  let offClean = 0, onShelled = 0, stray = 0, lostText = 0;
  for (const line of picks) {
    const iAttr = /<融 i="([^"]+)"/.exec(line)?.[1] ?? '';
    store.set('accelon26.fusionView', '0');
    const off = render(line);
    const offBalanced = (off.match(/<span/g) ?? []).length === (off.match(/<\/span>/g) ?? []).length;
    if (!off.includes('fusionBlock') && offBalanced) offClean++; else stray++;
    store.set('accelon26.fusionView', '1');
    const on = render(line);
    const shell = /<span class="fusionBlock" data-i="([^"]*)"/.exec(on)?.[1] ?? '';
    const onBalanced = (on.match(/<span/g) ?? []).length === (on.match(/<\/span>/g) ?? []).length;
    if (shell === iAttr && onBalanced) onShelled++; else stray++;
    const strip = (h: string) => h.replace(/<span class="fusionBlock"[^>]*><\/span>/g, '').replace(/<[^>]+>/g, '');
    if (strip(off) !== strip(on)) lostText++;
  }
  console.log(`④ 渲染器層 ${picks.length} 行：OFF 乾淨 ${offClean}、ON 出殼且 data-i 相符 ${onShelled}、span 配對問題 ${stray}、正文被吃 ${lostText}`);
  if (offClean !== picks.length || onShelled !== picks.length || stray > 0 || lostText > 0) bad++;
  store.set('accelon26.fusionView', '1');
  const deadLine = '<融 i="ybh?T1579-1#kpD99-999" n="論文・假" max="24"></融>正文在旁。';
  const dead = render(deadLine);
  const info = await nodeAnchorInfo(rd, 'T1579-1#kpD99-999');
  console.log(`   V7 等價：假錨解析=${info ? '竟然成功（意外）' : 'null（正確）'}、出殼=${dead.includes('fusionBlock')}、旁邊文字留存=${dead.includes('正文在旁')}`);
  if (info || !dead.includes('正文在旁')) bad++;
}
console.log(bad === 0 ? 'PASS' : `CHECK（${bad} 項未合）`);
process.exit(bad === 0 ? 0 : 1);
