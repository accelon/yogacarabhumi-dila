#!/usr/bin/env bun
/**
 * P4 前置驗證：`<融>` 三種寫法在「渲染器 OFF／ON」與「ADB 往返」下的實際行為，
 * 以及拿 ybh 真實卷級節點錨當融合目標時會填入多少文字。
 * 目的＝決定 build-ybh 要發哪一種形態（預設 OFF 必須零視覺負擔、ON 必須填得動）。
 */
import fs from 'node:fs';
const store = new Map<string, string>();
const el = () => ({ style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, after() {}, insertBefore() {} });
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' };
g.CSS = { highlights: new Map() };
g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); }, removeItem: (k: string) => { store.delete(k); } };

const { Accelon3Renderer } = await import('D:/2026/adb-converter/ts/src/accelon26/render_accelon3.ts');
const { authorAdb } = await import('D:/2026/adb-converter/ts/src/adbauthor.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { nodeAnchorInfo, nodeSubtreeEnd, nodeSpanText } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');

const cases: [string, string][] = [
  ['空成對', '<融 i="ybh?T1579-1#kpD03-001" n="論文・問答標列"></融>'],
  ['帶佔位', '<融 i="ybh?T1579-1#kpD03-001" n="論文">（開啟融視圖以填入論本）</融>'],
  ['自閉合', '<融 i="ybh?T1579-1#kpD03-001" n="論文"/>'],
];

console.log('=== ① 渲染器行為（localStorage accelon26.fusionView）');
const rd0 = new Map<string, number>();
for (const [name, markup] of cases) {
  for (const flag of ['0', '1', null]) {
    if (flag === null) store.delete('accelon26.fusionView'); else store.set('accelon26.fusionView', flag);
    const r = new Accelon3Renderer({ depthOf: rd0, levels: 0 } as any);
    const html = r.line('前句。' + markup + '後句。', 1);
    const opens = (html.match(/<span/g) ?? []).length, closes = (html.match(/<\/span>/g) ?? []).length;
    console.log(`  ${name} flag=${flag ?? 'unset'}：${JSON.stringify(html.slice(0, 130))}`);
    if (opens !== closes) console.log(`     ⚠ span 不配對：開 ${opens} 閉 ${closes}`);
  }
}

console.log('\n=== ② ADB 往返（寫進去再讀出來的原始位元組）');
const lines = ['<集 t="集">融形態測試</集>', '<樹 s="*" t="篇,章.">目錄</樹>', '<篇 id="X" t="章">X</篇>', '<章 id="X-1">卷1</章>'];
for (const [name, markup] of cases) lines.push(`${name}：${markup}`);
const res = await authorAdb({ dbname: 'rongshi', dbcname: '融形態測試', lines, dropNumeric: true } as any);
const out = 'D:/2026/_scratch-ybh/out/rongshi.adb';
fs.mkdirSync('D:/2026/_scratch-ybh/out', { recursive: true });
fs.writeFileSync(out, res.file);
const rr = await AdbReader.open(new SyncIO(out));
for (let b = 0; b < rr.containers.get('source')!.count; b++) {
  const t = await rr.sourceText(b);
  if (!t.includes('融')) continue;
  for (const l of t.split('\n')) if (l.includes('<融')) console.log('  讀回：' + JSON.stringify(l.slice(0, 120)));
}
console.log(`  標籤表含「融」：${rr.containers.get('tags')!.names.includes('融')}（hasFusionTag 靠這個決定開關是否渲染）`);

console.log('\n=== ③ 真實目標：ybh 卷級節點錨會填入多少字');
const yrd = await AdbReader.open(new SyncIO('D:/accelon3/ybh.adb'));
for (const a of ['T1579-1#kpD03-001', 'T1579-1#kpD04-006', 'T1579-13#kpD02-007', 'T1579-50#kpD02-013']) {
  const info = await nodeAnchorInfo(yrd, a);
  if (!info) { console.log(`  ${a} → 解析失敗`); continue; }
  const end = await nodeSubtreeEnd(yrd, info.va);
  for (const mx of [200, 400]) {
    const s = await nodeSpanText(yrd, info.va, end, mx);
    console.log(`  ${a} max=${mx}：${s.length} 字「${s.replace(/\n/g, '⏎').slice(0, 46)}…」`);
  }
}
