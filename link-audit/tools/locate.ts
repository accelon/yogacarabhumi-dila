import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import fs from 'fs';

const ROOT = 'D:/2026/yogacarabhumi-dila';
const out: string[] = []; const P = (...a: unknown[]) => out.push(a.join(' '));
const reader = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const mapper = new VaPaMapper(reader); await mapper.init();
const c = reader.containers.get('tags')!;
const page = await reader.decodeBlockList('tags', c.names.indexOf('頁'));
const vol = await reader.decodeBlockList('tags', c.names.indexOf('冊'));
const lineOf = (va: number) => mapper.lineOfVa(va);

async function buildVol(k: number) {           // k = 冊號（1 起）
  const s = vol[k - 1], e = vol[k] ?? page[page.length - 1] + 1;
  const map = new Map<string, { va: number; line: number }>();
  const bs = (arr: number[], x: number) => { let l = 0, h = arr.length; while (l < h) { const m = (l + h) >> 1; if (arr[m] < x) l = m + 1; else h = m; } return l; };
  const a = bs(page, s), b = bs(page, e);
  for (let i = a; i < b; i++) {
    const ln = lineOf(page[i]);
    const t = await mapper.lineText(ln);
    for (const m of t.matchAll(/<頁 id="(\d+p\d+[a-d])"\/>/g)) if (!map.has(m[1])) map.set(m[1], { va: page[i], line: ln });
  }
  return { map, marks: b - a, firstLine: lineOf(s), lastLine: lineOf(e) };
}
const cache = new Map<number, Awaited<ReturnType<typeof buildVol>>>();
const getVol = async (k: number) => cache.get(k) ?? (cache.set(k, await buildVol(k)), cache.get(k)!);

// 1) 本庫的大正引址到底寫成什麼樣
const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.md') && !/^_|README|索引/.test(f));
const RE = /大正(?:藏)?[：:]?\s*(?:冊)?\s*(\d+)[，,\s]+(\d+)([a-d])(\d*)/g;
const cites: { f: string; line: number; v: number; p: number; col: string; row: string; raw: string }[] = [];
const shapes = new Map<string, number>();
for (const f of files) {
  const ls = fs.readFileSync(ROOT + '/' + f, 'utf8').split('\n');
  for (let i = 0; i < ls.length && cites.length < 6000; i++) {
    for (const m of ls[i].matchAll(RE)) {
      shapes.set(m[0].replace(/\d+/g, 'N'), (shapes.get(m[0].replace(/\d+/g, 'N')) ?? 0) + 1);
      cites.push({ f, line: i + 1, v: +m[1], p: +m[2], col: m[3], row: m[4], raw: m[0] });
      if (cites.length >= 6000) break;
    }
  }
}
P('=== 1. 本庫內的大正引址 ===');
P('  匹配到的引址樣本數 ' + cites.length + '；寫法前 8 種：');
for (const [k, n] of [...shapes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) P('    ' + k.padEnd(22) + n);
const vols = [...new Set(cites.map(x => x.v))].sort((a, b) => a - b);
P('  涉及冊號: ' + vols.join(','));

// 2) 逐條解析成行號
P('\n=== 2. 用結構層解析（冊→頁欄→line）===');
let ok = 0, miss = 0, skip = 0; const missEx: string[] = [];
const perVol = new Map<number, [number, number]>();
for (const x of cites) {
  if (x.v < 1 || x.v >= vol.length) { skip++; continue; }
  const V = await getVol(x.v);
  const hit = V.map.get(x.v + 'p' + x.p + x.col);
  const t = perVol.get(x.v) ?? [0, 0]; if (hit) { t[0]++; ok++; } else { t[1]++; miss++; if (missEx.length < 8) missEx.push(x.f + ':' + x.line + ' 「' + x.raw + '」 冊' + x.v + ' 索引內頁標 ' + V.marks + ' 個'); }
  perVol.set(x.v, t);
}
P('  解析成功 ' + ok + ' / 頁標找不到 ' + miss + ' / 冊號超出 ' + skip);
P('  未命中例：'); for (const e of missEx) P('    ' + e);
P('  各冊命中/未命中：' + [...perVol.entries()].sort((a, b) => a[0] - b[0]).map(([k, [h, m]]) => '冊' + k + ':' + h + '/' + m).join(' '));

// 3) 抽查欄內行數：328c 起算的行距，驗證「c01」這種行號能不能靠數行得到
P('\n=== 3. 欄內行數與行號可解性（冊30）===');
const V30 = await getVol(30);
P('  冊30 頁標 ' + V30.marks + ' 個，line ' + V30.firstLine + '…' + V30.lastLine);
const keys = [...V30.map.entries()].map(([id, o]) => [id, o.line] as const);
const gaps: number[] = [];
for (let i = 1; i < keys.length; i++) gaps.push(keys[i][1] - keys[i - 1][1]);
gaps.sort((a, b) => a - b);
const q = (p: number) => gaps[Math.floor(gaps.length * p)] ?? 0;
P('  相鄰頁標之間的 adb 行數：p10=' + q(.1) + ' 中位=' + q(.5) + ' p90=' + q(.9) + ' max=' + gaps[gaps.length - 1]);
for (const id of ['30p279a', '30p328c', '30p1b']) {
  const o = V30.map.get(id);
  P('  ' + id + (o ? ' → line ' + o.line + ' va ' + o.va : ' → 找不到'));
}
const o = V30.map.get('30p279a');
if (o) { P('  該行原文（前 120 字元）：' + (await mapper.lineText(o.line)).slice(0, 120)); for (let l = o.line + 1; l <= o.line + 9; l++) P('    line ' + l + ': ' + (await mapper.lineText(l)).slice(0, 76)); }
fs.writeFileSync('D:/2026/_scratch-ybh/locate.txt', out.join('\n'), 'utf8');
console.log('done', out.length);
