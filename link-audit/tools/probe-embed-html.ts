const el = () => ({ style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, after() {}, insertBefore() {} });
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' }; g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; g.CSS = { highlights: new Map() };
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { pageHanTextOf } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
for (const [p, j] of [['30p280b', '30-40'], ['30p279a', '34-40'], ['30p576b', '421-432']] as [string, string][]) {
  const res = await renderEmbed('taisho', p, '', j, '', false, rd as any);
  const ph = await pageHanTextOf(rd, p);
  const [a, b] = j.split('-').map(Number);
  console.log('\n=== ' + p + ' #' + j + ' pageHanTextOf 長度 ' + ph.length + '，切片 ' + (b - a) + ' 字 = [' + ph.slice(a, b) + ']');
  console.log('renderEmbed html（前 700）：\n' + res.html.slice(0, 700));
}
