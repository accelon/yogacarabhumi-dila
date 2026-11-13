#!/usr/bin/env bun
/**
 * span-filter：以 renderEmbed（reader 實際取段碼路）逐條驗證 j 窗，
 * 窗首 6 漢字 ≠ 引文者就地剝窗（降級為純頁欄聯／僅聯），保證 shipped 資料
 * 「點開必對」。引文 ground truth 從源 md 重抽（完整行，非 16 字樣本）。
 */
import fs from 'node:fs';
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
const { renderEmbed } = await import('D:/2026/adb-converter/ts/src/accelon26/xref.ts');
const { AdbReader, SyncIO } = await import('D:/2026/adb-converter/ts/src/accelon26/adb.ts');

// ground truth 引文（完整行）
const GZ = /^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥][一二三四五六七八九十]{1,3}、/;
const quoteOf = new Map<string, string>();
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
    let qd = '';
    if (/^\|/.test(t)) {
      const cells = t.split('|').map((x) => x.trim().replace(/^>+/, '').trim()).filter((x) => x.length >= 4 && !/^[問答]：/.test(x) && !/^\d+$/.test(x));
      cells.sort((a, b) => b.length - a.length);
      qd = cells[0] ?? '';
    } else {
      const segs = t.split('　').map((x) => x.trim()).filter(Boolean);
      if (!segs.length || !segs.every((x) => GZ.test(x))) qd = t;
    }
    if (qd) { quoteOf.set(`${base}#${pending}`, qd); pending = null; }
  }
}

const rd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const rows = fs.readFileSync('D:/2026/_scratch-ybh/spans-j.tsv', 'utf8').split('\n').filter(Boolean);
const out = [rows[0]!];
let kept = 0, demoted = 0, noQuote = 0;
const samples: string[] = [];
for (const r of rows.slice(1)) {
  const c = r.split('\t');
  if (!c[4] || !c[5]) { out.push(r); continue; }
  const q = (quoteOf.get(`${c[1]}#${c[2]}`) ?? '').replace(/[^一-鿿]/g, '');
  if (q.length < 4) { noQuote++; out.push(r); continue; }   // 無完整引文可比者保守保留（多為表格邊例）
  const res = await renderEmbed('taisho', c[3]!, '', `${c[4]}-${c[5]}`, '', false, rd);
  const m = /<div class="embedText reflow">([\s\S]*?)<\/div>/.exec(res.html);
  const win = (m?.[1] ?? '').replace(/<[^>]*>/g, '').replace(/[^一-鿿]/g, '');
  const keyN = Math.min(6, win.length, q.length);
  if (win.length >= 4 && keyN >= 4 && win.startsWith(q.slice(0, keyN))) { kept++; out.push(r); }
  else {
    demoted++;
    if (samples.length < 5) samples.push(`${c[1]}#${c[2]} 窗「${win.slice(0, 8)}」≠「${q.slice(0, 6)}」`);
    out.push([c[0], c[1], c[2], c[3], '', '', c[6] + '-demoted'].join('\t'));
  }
}
fs.writeFileSync('D:/2026/_scratch-ybh/spans-j-verified.tsv', out.join('\n'), 'utf8');
console.log(`j 窗經 renderEmbed 實窗驗證：保留 ${kept}、剝窗 ${demoted}、無完整引文保守保留 ${noQuote} → spans-j-verified.tsv`);
if (samples.length) console.log(samples.join('\n'));
