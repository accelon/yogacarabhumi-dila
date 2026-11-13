#!/usr/bin/env bun
/** 死錨修正證據：引用處（披尋記標題文字）× 目標卷同層現存科判標題，唯一吻合者才入修正表。 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const WORKS = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','X0794'];
const CN = new Set(WORKS);
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const norm = (s: string) => s
  .replace(/\^kpD[\d-]+/g, '').replace(/\^kp#[^\s（(]*/g, '')      // 先剝錨點殘跡
  .replace(/^[A-Z]\d*\s*/, '').replace(/^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥][一二三四五六七八九十]{1,3}、/, '')
  .replace(/[0-9０-９\s　、，。：；（）()·]/g, '').slice(0, 16);   // 去序號標點

// 目標庫：base|tier → [{seq,title}]
const tierDefs = new Map<string, { seq: number; title: string }[]>();
const workKps = new Map<string, Set<string>>();
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.md'))) {
  const base = f.replace(/\.md$/, '');
  const ser = seriesOf(base);
  if (!CN.has(ser)) continue;
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n?/g, '\n');
  const s = workKps.get(ser) ?? new Set<string>();
  for (const m of t.matchAll(/^#{1,6}\s+(.*?)\s*\^kpD(\d+)-(\d+)\s*$/gm)) {
    s.add(`kpD${m[2]}-${m[3]}`);
    const key = `${base}|${m[2]}`;
    (tierDefs.get(key) ?? tierDefs.set(key, []).get(key)!).push({ seq: +m[3]!, title: norm(m[1]!) });
  }
  workKps.set(ser, s);
}

// 死錨引用＋其所屬披尋記標題
const fix = new Map<string, { to: string; why: string }>();
const ambiguous: string[] = [];
for (const f of fs.readdirSync(ROOT).filter((x) => x.endsWith('.md'))) {
  const base = f.replace(/\.md$/, '');
  if (!CN.has(seriesOf(base))) continue;
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n?/g, '\n').split('\n');
  let curTitle = '';
  lines.forEach((ln) => {
    const hm = /^#{1,6}\s+(.*?)\s*$/.exec(ln);
    if (hm) { curTitle = norm(hm[1]!); return; }
    for (const m of ln.matchAll(/\[\[([^\]|#]+)#\^(kpD(\d+)-(\d+))[^\]]*\]\]/g)) {
      const tgt = m[1]!.trim();
      const tSer = seriesOf(tgt);
      if (!CN.has(tSer)) continue;
      const kp = `kpD${m[3]}-${m[4]}`;
      if (workKps.get(tSer)?.has(kp)) continue;
      const key = `${tgt}#${kp}`;
      if (fix.has(key) || ambiguous.includes(key)) continue;
      const cands = (tierDefs.get(`${tgt}|${m[3]}`) ?? []).filter((c) => c.title.length >= 2 && curTitle.length >= 2 && (c.title === curTitle || c.title.startsWith(curTitle) || curTitle.startsWith(c.title)));
      if (cands.length === 1) fix.set(key, { to: `kpD${m[3]}-${String(cands[0]!.seq).padStart(3, '0')}`, why: `標題吻合「${curTitle}」` });
      else if (cands.length > 1) ambiguous.push(key);
    }
  });
}
console.log(`可修（標題唯一吻合）：${fix.size} 種｜模糊（多候選）：${ambiguous.length} 種`);
for (const [k, v] of [...fix.entries()].slice(0, 12)) console.log(`  ${k} → ${v.to}  ${v.why}`);
const out = ['deadKey\tfixedKey\tevidence'];
for (const [k, v] of fix) out.push(`${k}\t${k.split('#')[0]}#${v.to}\t${v.why}`);
fs.writeFileSync('D:/2026/yogacarabhumi-dila/link-audit/data/dead-anchor-fixes.tsv', out.join('\n'), 'utf8');
console.log('修正表 → link-audit/data/dead-anchor-fixes.tsv');
