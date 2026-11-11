import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import fs from 'fs';

const ROOT = 'D:/2026/yogacarabhumi-dila';
const out: string[] = []; const P = (...a: unknown[]) => out.push(a.join(' '));
const reader = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
const mapper = new VaPaMapper(reader); await mapper.init();
const c = reader.containers.get('tags')!;
const vol = await reader.decodeBlockList('tags', c.names.indexOf('冊'));
const lineOf = (va: number) => mapper.lineOfVa(va);
const s = lineOf(vol[29]), e = lineOf(vol[30]);
const map = new Map<string, number>();
const re = /<頁 id="(\d+)p(\d+)([a-d])"\/>/g;
const colCount: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
for (let l = s; l <= e; l++) {
  const t = await mapper.lineText(l); let m; re.lastIndex = 0;
  while ((m = re.exec(t))) { const id = m[1] + 'p' + m[2] + m[3]; if (!map.has(id)) { map.set(id, l); colCount[m[3]]++; } }
}
P('=== 冊30 欄標分布 ===');
P('  ' + Object.entries(colCount).map(([k, v]) => k + '欄:' + v).join('  ') + '   共 ' + map.size + ' 個；line ' + s + '…' + e);

// 引址中「找不到」的是哪些欄
const RE = /大正(?:藏)?[：:]?\s*(?:冊)?\s*(\d+)[，,\s]+(\d+)([a-d])(\d*)/g;
const files = fs.readdirSync(ROOT).filter(f => /^T1579-\d+\.md$/.test(f)).sort((a, b) => +a.match(/\d+/)![0] - +b.match(/\d+/)![0]);
const missCol: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
const hitCol: Record<string, number> = { a: 0, b: 0, c: 0, d: 0 };
type Job = { f: string; line: number; id: string; row: number; key: string };
const jobs: Job[] = [];
for (const f of files) {
  const md = fs.readFileSync(ROOT + '/' + f, 'utf8').split('\n');
  for (let i = 0; i < md.length; i++) {
    const t = md[i]; if (!/大正/.test(t)) continue;
    RE.lastIndex = 0; const m = RE.exec(t); if (!m || +m[1] !== 30) continue;
    const id = '30p' + m[2] + m[3], row = parseInt(m[4] || '0', 10);
    if (map.has(id)) hitCol[m[3]]++; else missCol[m[3]]++;
    if (!map.has(id) || !row || jobs.length >= 600) continue;
    // 取引址之後第一段純正文（跳過標題／連結／括注），取前 8 個漢字當鍵
    for (let j = i + 1; j < Math.min(i + 60, md.length); j++) {
      const x = md[j].trim();
      if (!x || /^[#《〔\[|]/.test(x) || /（大正|（披尋記|\[\[|\[\^/.test(x)) continue;
      const cjk = x.replace(/[^\u4e00-\u9fff]/g, '');
      if (cjk.length < 10) continue;
      jobs.push({ f, line: i + 1, id, row, key: cjk.slice(0, 8) });
      break;
    }
  }
}
P('\n=== 引址地址可落地率（按欄）===');
P('  命中: ' + Object.entries(hitCol).map(([k, v]) => k + ':' + v).join(' ') + '   找不到: ' + Object.entries(missCol).map(([k, v]) => k + ':' + v).join(' '));
P('  → d 欄佔未命中的 ' + (100 * missCol.d / (missCol.a + missCol.b + missCol.c + missCol.d)).toFixed(0) + '%');

// 行號偏移一致率
const cache = new Map<number, string>();
const cjkLine = async (l: number) => { let v = cache.get(l); if (v === undefined) { v = (await mapper.lineText(l)).replace(/[^\u4e00-\u9fff]/g, ''); cache.set(l, v); } return v; };
const deltas: number[] = []; let notFound = 0;
for (const jb of jobs) {
  const base = map.get(jb.id)!; let found = -1;
  for (let l = base; l <= base + 60 && l <= e; l++) { if ((await cjkLine(l)).includes(jb.key)) { found = l - base; break; } }
  if (found < 0) notFound++; else deltas.push(found - (jb.row - 1));
}
const hist: Record<string, number> = {};
for (const d of deltas) hist[d] = (hist[d] || 0) + 1;
P('\n=== 行號一致率（偏移是否恆為 引址行號−1）===');
P('  可比較樣本 ' + deltas.length + '／取樣 ' + jobs.length + '，adb 內找不到該句 ' + notFound);
P('  delta =（實測行偏移 − (引址行號−1)）分布: ' + Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => 'Δ' + k + ':' + v).join('  '));
const zero = hist['0'] || 0;
P('  完全一致（Δ=0）比率: ' + (100 * zero / deltas.length).toFixed(1) + '%');
fs.writeFileSync('D:/2026/_scratch-ybh/locate3.txt', out.join('\n'), 'utf8');
console.log('done', out.length);
