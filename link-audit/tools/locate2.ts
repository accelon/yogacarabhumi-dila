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

async function scanVol(k: number) {                      // 整卷逐行掃 <頁 id>
  const s = lineOf(vol[k - 1]), e = lineOf(vol[k] ?? page[page.length - 1]);
  const map = new Map<string, number>();
  const re = /<頁 id="(\d+)p(\d+)([a-d])"\/>/g;
  for (let l = s; l <= e; l++) {
    const t = await mapper.lineText(l);
    let m; re.lastIndex = 0;
    while ((m = re.exec(t))) if (!map.has(m[1] + 'p' + m[2] + m[3])) map.set(m[1] + 'p' + m[2] + m[3], l);
  }
  return { map, firstLine: s, lastLine: e };
}
const V30 = await scanVol(30);
P('=== 冊30 整卷掃標記 ===');
P('  line 範圍 ' + V30.firstLine + '…' + V30.lastLine + '（' + (V30.lastLine - V30.firstLine).toLocaleString('en-US') + ' 行），掃到頁欄標 ' + V30.map.size + ' 個；tags 容器報 ' + (() => { const bs = (a: number[], x: number) => { let l = 0, h = a.length; while (l < h) { const m = (l + h) >> 1; if (a[m] < x) l = m + 1; else h = m; } return l; }; return bs(page, vol[30]) - bs(page, vol[29]); })() + ' 個 頁 實例');
for (const id of ['30p279a', '30p328c', '30p875c', '30p876d', '30p326d']) P('  ' + id.padEnd(10) + ' → line ' + (V30.map.get(id) ?? '找不到'));

P('\n=== 本庫引址在修正後的索引上能否落地（冊30 全部引址）===');
const RE = /大正(?:藏)?[：:]?\s*(?:冊)?\s*(\d+)[，,\s]+(\d+)([a-d])(\d*)/g;
function nextBody(md: string[], from: number): string {
  for (let i = from; i < Math.min(from + 40, md.length); i++) {
    const t = md[i].trim().replace(/\[\[[\s\S]*?\]\](?!\])/g, '').replace(/\[\^[^\]]+\]/g, '').replace(/^[#《〔\[]|（大正|（披尋記.*/, '').trim();
    const cjk = (t.match(/[一-鿿]/g) || []).length;
    if (cjk >= 8) return t;
  }
  return '';
}
const files = fs.readdirSync(ROOT).filter(f => /^T1579-\d+\.md$/.test(f));
let okCol = 0, badCol = 0, rowOk = 0, rowBad = 0; const samples: string[] = [];
for (const f of files) {
  const md = fs.readFileSync(ROOT + '/' + f, 'utf8').split('\n');
  for (let i = 0; i < md.length; i++) {
    const m = RE.exec(md[i]); if (!m || +m[1] !== 30) continue; RE.lastIndex = 0;
    const id = '30p' + m[2] + m[3], ln = V30.map.get(id);
    const row = parseInt(m[4] || '0', 10);
    if (ln === undefined) { badCol++; continue; } okCol++;
    const body = nextBody(md, i); if (!body || !row) continue;
    const key = body.slice(0, 6);
    let found = -1;
    for (let l = ln; l <= ln + 40 && l <= V30.lastLine; l++) { const t = (await mapper.lineText(l)).replace(/[^\u4e00-\u9fff]/g, ''); if (t.includes(key)) { found = l - ln; break; } }
    if (found >= 0) rowOk++; else rowBad++;
    if (samples.length < 10) samples.push(f + ':' + (i + 1) + ' 「' + m[0] + '」 頁標line=' + ln + '  本庫句「' + key + '…」於 adb line+' + (found < 0 ? '找不到' : found) + '（引址行號=' + row + '）');
  }
}
P('  欄級地址可落地: ' + okCol + ' 找不到: ' + badCol + '   → ' + (100 * okCol / (okCol + badCol)).toFixed(1) + '%');
P('  欄內行號驗證（拿本庫正文句去 adb 找出現偏移）: 命中 ' + rowOk + '  未命中 ' + rowBad);
for (const s of samples) P('    ' + s);
fs.writeFileSync('D:/2026/_scratch-ybh/locate2.txt', out.join('\n'), 'utf8');
console.log('done', out.length);
