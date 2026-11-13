import fs from 'node:fs';
const el = () => ({ style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {}, addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, after() {}, insertBefore() {} });
const g = globalThis as any;
g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
g.navigator = { userAgent: 'test' }; g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; g.CSS = { highlights: new Map() };
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { hanChars } = await import('D:/2026/adb-converter/ts/src/accelon26/han.ts');
const SER = process.argv[2] ?? 'PXJ-H';
const N = +(process.argv[3] ?? 6);
const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const V = 'D:/2026/yogacarabhumi-dila';
const csv = fs.readFileSync('D:/2026/_scratch-ybh/zhu-refs-' + SER + '-review.csv', 'utf8').replace(/^/, '').split('\r\n');
const text = new Map<string, string>();
for (const l of csv.slice(1)) {
  const m = l.match(/^"([^"]*)","(\d+)"[^\n]*?,"([^"]*)"$/);
  if (m) text.set(m[1] + '#' + m[2], m[3]);
}
const rows = fs.readFileSync('D:/2026/_scratch-ybh/zhu-refs-' + SER + '.tsv', 'utf8').split('\n').slice(1)
  .map((l) => l.split('\t')).filter((c) => c.length >= 8 && c[6] === 'Q2');
const modes: Record<string, number> = {};
for (const c of fs.readFileSync('D:/2026/_scratch-ybh/zhu-refs-' + SER + '.tsv', 'utf8').split('\n').slice(1).map((l) => l.split('\t'))) if (c.length >= 8) modes[c[6]!] = (modes[c[6]!] ?? 0) + 1;
console.log(SER + ' 層級分佈：' + Object.entries(modes).map(([k, v]) => k + ':' + v).join('  '));
const step = Math.max(1, Math.floor(rows.length / N));
for (let i = 0; i < rows.length && i < N * step; i += step) {
  const c = rows[i]!;
  const res = await renderEmbed('taisho', c[3]!, '', c[4] + '-' + c[5], '', false, rd as any);
  const mark = hanChars((/<mark class="xrefHit">([\s\S]*?)<\/mark>/.exec(res.html)?.[1] ?? '').replace(/<[^>]*>/g, '')).join('');
  console.log('L' + c[1] + ' 段「' + (text.get(c[0] + '#' + c[1]) ?? '').slice(0, 22) + '」→ ' + c[3] + '#' + c[4] + '-' + c[5] + ' 窗「' + mark.slice(0, 26) + '」');
}
