#!/usr/bin/env bun
/** 死錨人工複核清單：CN 檔中指向「全著作無此定義」kpD 的引用，附出處與序號診斷。 */
import fs from 'node:fs';
import path from 'node:path';
const ROOT = 'D:/2026/yogacarabhumi-dila';
const WORKS = ['T1579','PXJ-H','T1580','T1828','T1829','T2801','T2802','T2259','T1581','T1582','T1583','T1584','T1602','T1604','T1605','T1606','X0794'];
const CN = new Set(WORKS);
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
const files = fs.readdirSync(ROOT).filter((f) => f.endsWith('.md')).sort();

// 定義集：base → tier → Set<seq>；work → Set<kp>
const defByVolTier = new Map<string, Map<number, Set<number>>>();
const defByWork = new Map<string, Set<string>>();
const fileExists = new Set<string>();
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  const ser = seriesOf(base);
  if (!CN.has(ser)) continue;
  fileExists.add(base);
  const t = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n?/g, '\n');
  const m = defByWork.get(ser) ?? new Set<string>();
  const byTier = new Map<number, Set<number>>();
  for (const hm of t.matchAll(/^#{1,6} .*?\^kpD(\d+)-(\d+)\s*$/gm)) {
    const tier = +hm[1]!, seq = +hm[2]!;
    m.add(`kpD${hm[1]}-${hm[2]}`);
    (byTier.get(tier) ?? byTier.set(tier, new Set()).get(tier)!).add(seq);
  }
  defByWork.set(ser, m);
  defByVolTier.set(base, byTier);
}

// 收集死錨引用
type Dead = { key: string; count: number; srcs: string[]; labels: Set<string> };
const dead = new Map<string, Dead>();
for (const f of files) {
  const base = f.replace(/\.md$/, '');
  if (!CN.has(seriesOf(base))) continue;
  const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\r\n?/g, '\n').split('\n');
  lines.forEach((ln, i) => {
    for (const m of ln.matchAll(/\[\[([^\]|#]+)#\^(kpD(\d+)-(\d+))[^\]]*\]\]/g)) {
      const tgt = m[1]!.trim();
      const tSer = seriesOf(tgt);
      if (!CN.has(tSer)) continue;
      const kp = `kpD${m[3]}-${m[4]}`;
      if (defByWork.get(tSer)?.has(kp)) continue;   // 全著作有定義 → 非死錨
      const key = `${tgt}#${kp}`;
      const d = dead.get(key) ?? { key, count: 0, srcs: [], labels: new Set<string>() };
      d.count++;
      if (d.srcs.length < 4) d.srcs.push(`${base}:${i + 1}`);
      const lab = /\|([^\]|]*)\]\]/.exec(m[0])?.[1];
      if (lab) d.labels.add(lab.trim());
      dead.set(key, d);
    }
  });
}

const rows: string[] = ['target#anchor\trefs\t診斷\t目標卷同層現存序號(最近)\t出處(檔:行)\t標籤'];
let ph = 0, offby = 0, nofile = 0, notier = 0, other = 0;
for (const d of [...dead.values()].sort((a, b) => b.count - a.count)) {
  const mm = /^(.+)#kpD(\d+)-(\d+)$/.exec(d.key)!;
  const tgt = mm[1]!, tier = +mm[2]!, seq = +mm[3]!;
  let diag: string;
  if (!fileExists.has(tgt)) { diag = '目標檔不存在'; nofile++; }
  else if (seq >= 9995) { diag = 'DILA 佔位序號(9995+)'; ph++; }
  else {
    const set = defByVolTier.get(tgt)?.get(tier);
    if (!set || !set.size) { diag = '目標卷無此層科判'; notier++; }
    else {
      const arr = [...set].sort((a, b) => a - b);
      const near = arr.reduce((a, b) => (Math.abs(b - seq) < Math.abs(a - seq) ? b : a));
      if (Math.abs(near - seq) <= 2) { diag = `疑似錯一位（最近實有 ${near}）`; offby++; }
      else diag = `卷內該層 ${arr.length} 條、最近 ${near}`;
    }
  }
  const set = defByVolTier.get(tgt)?.get(tier);
  const nearTxt = set && set.size ? [...set].sort((a, b) => a - b).slice(0, 6).join(',') : '—';
  rows.push(`${d.key}\t${d.count}\t${diag}\t${nearTxt}\t${d.srcs.join(' ')}\t${[...d.labels].slice(0, 3).join('、')}`);
}
const tot = [...dead.values()].reduce((s, d) => s + d.count, 0);
console.log(`死錨 ${dead.size} 種、引用 ${tot} 條｜診斷：佔位 ${ph}、錯一位 ${offby}、目標卷無此層 ${notier}、目標檔缺 ${nofile}、其他 ${other}`);
fs.writeFileSync('D:/2026/yogacarabhumi-dila/link-audit/data/ybh-dead-anchors-review.tsv', rows.join('\n'), 'utf8');
console.log('清單 → link-audit/data/ybh-dead-anchors-review.tsv');
