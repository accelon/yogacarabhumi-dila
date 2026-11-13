import fs from 'node:fs';
import path from 'node:path';
import { openAdb } from 'D:/2026/adb-converter/ts/tools/adb-skill/engine.ts';
import { loadTrees, loadTree } from 'D:/2026/adb-converter/ts/src/accelon26/search.ts';

const ROOT = 'D:/2026/yogacarabhumi-dila';
const ADB = 'D:/2026/_scratch-ybh/ybh/ybh.adb';
const o: string[] = []; const P = (...a: unknown[]) => o.push(a.join(' '));

// 1) 語言覆核（剝除標記後）
const CN = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','T0099','X0794'];
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const strip = (t: string) => t.replace(/\[\[[\s\S]*?\]\](?!\])/g, '').replace(/\[\^[^\]]+\]:?/g, '')
  .replace(/\^kp[D#][\w#\-]*/g, '').replace(/<[^>]*>/g, '').replace(/[#*`|>\-]/g, '');
let bad = 0; const badEx: string[] = []; let files = 0;
for (const f of fs.readdirSync(ROOT).filter(x => x.endsWith('.md'))) {
  const base = f.replace(/\.md$/, ''); if (!CN.includes(seriesOf(base))) continue;
  files++;
  const t = strip(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const tib = (t.match(/[\u0f00-\u0fff]/g) || []).length;
  const lat = (t.match(/[A-Za-z]/g) || []).length;
  const tot = cjk + tib + lat || 1;
  if (cjk / tot < 0.9) { bad++; if (badEx.length < 6) badEx.push(`${base} CJK ${(100*cjk/tot).toFixed(1)}% tib=${tib} lat=${lat}`); }
}
P('=== 1. 語言覆核（剝除 wikilink/錨點/markdown 後）===');
P(`  漢文系列 ${CN.length} 個，檔案 ${files} 個；CJK<90% 的异常 ${bad} 個`);
for (const e of badEx) P('    ' + e);

// 2) 讀回 adb
const db = await openAdb(ADB);
P('\n=== 2. adb 檔頭 ===');
P(`  dbname=${db.dbname} title=${db.title} lines=${db.lines.toLocaleString('en-US')} tags=[${db.tags.join(' ')}]`);
P(`  file=${(fs.statSync(ADB).size/1048576).toFixed(2)} MiB`);

// 3) 目錄樹
const trees = await loadTrees(db.reader);
P('\n=== 3. 目錄樹 ===');
for (const t of trees) P(`  樹#${t.index} scope=${JSON.stringify(t.scope)} tiers=${JSON.stringify(t.tiers)} terminal=${t.terminalTier}`);
const nodes = await loadTree(db.reader, trees[0]);
const byDepth = new Map<number, number>();
for (const n of nodes as any[]) byDepth.set(n.depth ?? 0, (byDepth.get(n.depth ?? 0) || 0) + 1);
P('  樹節點總數 ' + nodes.length + '，依層深: ' + [...byDepth.entries()].sort((a,b)=>a[0]-b[0]).map(([d,c])=>`depth${d}:${c}`).join(' '));
P('  前 14 個節點:');
for (const n of (nodes as any[]).slice(0, 14)) P(`    d${n.depth} <${n.tag}> ${String(n.label ?? '').slice(0,40)} va=${n.va}`);

// 4) 科判節點与腳註
const rd: any = db.reader;
const tagCount = async (name: string) => { const c = rd.containers.get('tags'); const i = c.names.indexOf(name); if (i < 0) return 0; return (await rd.decodeBlockList('tags', i)).length; };
P('\n=== 4. 結構標籤實例數 ===');
for (const t of ['篇','章','節','註','釋']) P(`  <${t}> ${await tagCount(t)}`);
// 節的 n= 屬性（kpD 錨點）是否存進 attributes
const av = await rd.attributeValues('節.n').catch(() => null);
P('  節.n 屬性值數量: ' + (av?.values?.length ?? 0) + '，前 5: ' + JSON.stringify((av?.values ?? []).slice(0,5)));

// 5) 全文搜尋實測
P('\n=== 5. 搜尋實測 ===');
for (const q of ['云何瑜伽師地', '三摩呬多地', '菩薩地', '披尋記']) {
  const r = await db.search(q, 2);
  P(`  「${q}」 total=${r.total} ms=${r.ms}` + (r.hits.length ? ` 首命中 line=${r.hits[0].line}: ${r.hits[0].text.slice(0,46)}` : ' (無命中)'));
}
// 6) 腳註配對抽檢：找一個 釋 与其 註
const raw = await db.raw(0);
P('\n=== 6. 檔頭前 3 行原文 ===');
for (let i = 0; i < 3; i++) P('  ' + (await db.raw(i)).slice(0, 150));
fs.writeFileSync('D:/2026/_scratch-ybh/ybh/verify.txt', o.join('\n'), 'utf8');
console.log(o.join('\n'));
