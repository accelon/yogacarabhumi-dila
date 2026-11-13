/** 對母區三筆聲稱做我方獨立複驗：1fa56e7（斷言對齊）、09d4625（缺陷 1＋2）、678ece1（缺陷 3）。 */
const el = () => ({ style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, after() {}, insertBefore() {} });
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' }; g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; g.CSS = { highlights: new Map() };
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { pageHanTextOf } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));

console.log('① 缺陷 2 複驗（頁字串是否已截在頁界內）');
for (const p of ['30p279a', '30p282a', '30p345a', '30p793a']) {
  const ph = await pageHanTextOf(rd, p);
  console.log(`   ${p} 長度 ${ph.length}`);
}
const ph793 = await pageHanTextOf(rd, '30p793a');
for (const needle of ['復次嗢拕', '复次嗢拕']) {
  const i = ph793.indexOf(needle);
  console.log(`   R3 pin：indexOf(「${needle}」) = ${i}${i === 38 ? ' ＝38 綠' : ''}`);
}

console.log('\n② 缺陷 3 複驗（嵌卡卡頭書名）');
for (const [p, j] of [['30p279a', '34-40'], ['30p576b', '421-432'], ['30p478b', '0-80']] as [string, string][]) {
  const res = await renderEmbed('taisho', p, '', j, '', false, rd as any);
  const src = /<span class="embedSrc">([^<]*)<\/span>/.exec(res.html)?.[1] ?? '(無)';
  const mk = /<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '';
  console.log(`   ${p}#${j}：embedSrc=「${src}」窗首=「${mk.slice(0, 10)}」`);
}

console.log('\n③ 越界 j 的現行行為（缺陷 1 是否改鉗製）');
for (const j of ['337-361', '400-420']) {
  const res = await renderEmbed('taisho', '30p279a', '', j, '', false, rd as any);
  const mk = (/<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '').replace(/<[^>]*>/g, '');
  console.log(`   30p279a#${j} → ${mk.length} 字「${mk.slice(0, 14)}」`);
}
