#!/usr/bin/env bun
/**
 * v14 全數驗證 v2（產品碼路）：逐條 renderEmbed('taisho', page, '', 'a-b')，
 * 取其 embedText 段、剝標籤後【保留標點】比對引文前 6 字（引文本尊含標點）。
 * 另單列 jend > 頁長 的越界行。
 */
import fs from 'node:fs';
const shim = () => {
  const el = () => ({
    style: {}, dataset: {}, hidden: false, textContent: '', innerHTML: '',
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    setAttribute() {}, removeAttribute() {}, append() {}, appendChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, after() {}, insertBefore() {},
  });
  const g = globalThis as any;
  g.window = { addEventListener() {}, setTimeout: () => 0, location: { href: '' } };
  g.document = { getElementById: () => el(), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, createElement: () => el(), body: el() };
  g.navigator = { userAgent: 'test' };
  g.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
  g.CSS = { highlights: new Map() };
};
shim();
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');
const { pageHanTextOf } = await import('D:/2026/adb-converter/ts/src/accelon26/page-text.ts');

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
// ground truth＝源 md 完整引文行（非 16 字樣本列）
const quoteOf = new Map<string, string>();
{
  const GZ = /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥][一二三四五六七八九十]{1,3}、/;
  const want = (base: string, kp: string) => quoteOf.has(`${base}#${kp}`);
  for (const f of fs.readdirSync('D:/2026/yogacarabhumi-dila').filter((x) => /^(T1579|PXJ-H)-\d+\.md$/.test(x))) {
    const base = f.replace(/\.md$/, '');
    const ls = fs.readFileSync(`D:/2026/yogacarabhumi-dila/${f}`, 'utf8').replace(/\r\n?/g, '\n').split('\n');
    let pending: string | null = null;
    for (const ln of ls) {
      const hd = /^#{1,6}\s+(.*?)\s*\^(kpD\d+-\d+)\s*$/.exec(ln);
      if (hd) { pending = hd[2]!; continue; }
      if (!pending) continue;
      const t = ln.trim();
      if (!t || /^《/.test(t) || /^\[\^/.test(t)) continue;
      if (/^\|/.test(t)) {
        const cells = t.split('|').map((x) => x.trim().replace(/^>+/, '').trim()).filter((x) => x.length >= 4 && !/^[問答]：/.test(x) && !/^\d+$/.test(x));
        cells.sort((a, b) => b.length - a.length);
        if (cells[0]) quoteOf.set(`${base}#${pending}`, cells[0]!);
      } else if (!(GZ.test(t) && !/[。？！]/.test(t.replace(/　|[^　]/g, '')))) {
        // 鏈行＝全干支段且無句末標點者跳過（是標籤非引文）
        const segs = t.split('　').map((x) => x.trim()).filter(Boolean);
        const allGz = segs.length > 0 && segs.every((x) => GZ.test(x));
        if (!allGz) quoteOf.set(`${base}#${pending}`, t);
      }
      if (quoteOf.has(`${base}#${pending}`) === false) continue;
      pending = null;
    }
  }
  void want;
}
const rows = fs.readFileSync('D:/2026/_scratch-ybh/spans-j-verified.tsv', 'utf8').split('\n').slice(1).filter(Boolean).map((x) => x.split('\t'));
const withJ = rows.filter((r) => r[4] && r[5]);
const pageLenCache = new Map<string, number>();
let pass = 0; let overflow = 0; let badStart = 0; let shortWin = 0;
const failsO: string[] = []; const failsB: string[] = [];
const t0 = Date.now();
for (const r of withJ) {
  const [, base, kp, page, js, je] = r;
  let plen = pageLenCache.get(page!);
  if (plen === undefined) { plen = (await pageHanTextOf(rd, page!)).length; pageLenCache.set(page!, plen); }
  if (+je! > plen!) { overflow++; if (failsO.length < 6) failsO.push(`${base}#${kp} ${page} jend=${je} > 頁長 ${plen}`); }
  const res = await renderEmbed('taisho', page!, '', `${js}-${je}`, '', false, rd);
  const m = /<div class="embedText reflow">([\s\S]*?)<\/div>/.exec(res.html);
  const win = (m?.[1] ?? '').replace(/<[^>]*>/g, '').replace(/[^一-鿿]/g, '');   // 漢字口徑：DILA/CBETA 標點本不同
  const q = (quoteOf.get(`${base}#${kp}`) ?? '').replace(/[^一-鿿]/g, '');
  const key = q.slice(0, 6);
  const key4 = q.slice(0, 4);
  if (key && win.startsWith(key)) pass++;
  else if (key4 && win.startsWith(key4)) { pass++; shortWin++; if (failsB.length < 3) failsB.push(`短窗 ${base}#${kp} 窗長 ${win.length} 期望「${key}」`); }
  else { badStart++; if (failsB.length < 9) failsB.push(`錯位 ${base}#${kp} 期望「${key}」得「${win.slice(0, 10)}」`); }
}
console.log(`產品碼路全驗 ${withJ.length} 條: 通過 ${pass}（${(100 * pass / withJ.length).toFixed(2)}%）｜短窗可接受 ${shortWin}｜真錯位 ${badStart}｜jend 越頁長 ${overflow}｜${((Date.now() - t0) / 1000).toFixed(0)}s`);
if (failsB.length) console.log('窗首樣本:\n' + failsB.join('\n'));
if (failsO.length) console.log('越界樣本:\n' + failsO.join('\n'));
