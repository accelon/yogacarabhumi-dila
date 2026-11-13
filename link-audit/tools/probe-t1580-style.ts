import fs from 'node:fs';
const t = fs.readFileSync('D:/2026/yogacarabhumi-dila/T1580-1.md', 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const ls = t.split('\n');
const cnt = (re: RegExp) => ls.filter((l) => re.test(l)).length;
const occ = (s: string) => t.split(s).length - 1;
for (const w of ['論曰', '釋曰', '又釋', '解曰', '文曰']) console.log(`${w}：行 ${cnt(new RegExp('^' + w))}｜含此行 ${cnt(new RegExp(w))}｜總次數 ${occ(w)}`);
// 段起首二字分佈（看主流文體）
const heads: Record<string, number> = {};
for (let i = 0; i < ls.length; i++) {
  const s = ls[i]!.trim();
  if (!s || /^#/.test(s) || /^《/.test(s) || /^\[/.test(s)) continue;
  const p = (i > 0 ? ls[i - 1]! : '').trim();
  if (p && !/^#/.test(p) && !/^《/.test(p) && !/^\[/.test(p)) continue;   // 非段起
  const k = s.slice(0, 2);
  heads[k] = (heads[k] ?? 0) + 1;
}
const arr = Object.entries(heads).sort((a, b) => b[1] - a[1]);
const total = arr.reduce((a, b) => a + b[1], 0);
console.log(`\n段起 ${total} 條，前 25 组起首詞：`);
console.log(arr.slice(0, 25).map(([k, v]) => `${k}:${v}`).join('  '));
