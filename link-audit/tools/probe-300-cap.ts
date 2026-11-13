import fs from 'node:fs';
const el = () => ({ style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, after() {}, insertBefore() {} });
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' }; g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; g.CSS = { highlights: new Map() };
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { pageHanTextOf } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const { hanChars } = await import('D:/2026/adb-converter/ts/src/accelon26/han.ts');
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const cases: [string, string][] = [
  ['30p279a', '40-44'], ['30p279a', '250-270'], ['30p279a', '290-320'], ['30p279a', '337-361'],
  ['30p279b', '463-467'], ['30p345a', '239-340'], ['30p282a', '450-474'],
];
for (const [p, j] of cases) {
  const res = await renderEmbed('taisho', p, '', j, '', false, rd as any);
  const mark = hanChars((/<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '').replace(/<[^>]*>/g, '')).join('');
  const ph = await pageHanTextOf(rd, p);
  const [a, b] = j.split('-').map(Number);
  console.log(`${p}#${j}：要求 ${b - a} 字｜mark ${mark.length} 字「${mark.slice(0, 18)}」｜pageHanTextOf 切片「${ph.slice(a, b).slice(0, 18)}」｜頁文字串長 ${ph.length}`);
}
