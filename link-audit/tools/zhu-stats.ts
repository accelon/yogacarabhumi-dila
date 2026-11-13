import fs from 'node:fs';
const SCR = 'D:/2026/_scratch-ybh';
for (const f of fs.readdirSync(SCR).filter((x) => /^zhu-refs-.+\.tsv$/.test(x)).sort()) {
  const ser = /zhu-refs-(.+)\.tsv$/.exec(f)![1]!;
  const rows = fs.readFileSync(`${SCR}/${f}`, 'utf8').split('\n').slice(1).filter((x) => x.trim());
  const mode: Record<string, number> = {}, key = new Map<string, number>();
  let runs = 0, last = '';
  for (const ln of rows) {
    const c = ln.split('\t');
    mode[c[6]!] = (mode[c[6]!] ?? 0) + 1;
    if (c[6] === 'none' || c[6] === 'drop' || c[6] === 'dup') continue;
    const k = `${c[3]}#${c[4]}-${c[5]}`;
    key.set(k, (key.get(k) ?? 0) + 1);
    if (k !== last) runs++;
    last = k;
  }
  const kept = [...key.values()].reduce((a, b) => a + b, 0);
  const top = [...key.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}×${v}`).join(' ');
  console.log(`${ser}: 段落行 ${rows.length}｜採纳 ${kept}｜去重後(連窗收攏) ${runs}｜distinct 窗 ${key.size}｜mode ${Object.entries(mode).map(([a, b]) => `${a}:${b}`).join(' ')}｜最大窗 ${top}`);
}
