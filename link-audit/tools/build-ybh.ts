#!/usr/bin/env bun
/**
 * yogacarabhumi-dila 漢文 → ybh.adb
 * 只收漢文著作（依 DILA 權威略符表），排除梵本/藏譯。
 * 結構：篇（著作，亦是搜尋分群）＞章（卷）；科判標題→<節 n="kpD…">；腳註→註/釋。
 * 互鏈 v3：adb-converter 已上「通用節點錨點」（NS#值 篇級解析，见 prompt-ybh-anchor-adopt.md）。
 *   互鏈 v4（卷級別名 d224efd 已上線）：目標卷有定義 → `W-V#kp` 卷級嵌；全著作唯一点 → 篇級嵌；
 *   撞號無定義／死錨／未入庫／校注錨 → 文字。負控翻為 ALIAS-ARRIVED＋語義回歸 last≠first。
 *   <篇 id>／<章 id> 已加；產出 works.tsv＋anchor-check.tsv 隨檔驗收。
 */
import fs from 'node:fs';
import path from 'node:path';
import { authorAdb } from 'D:/2026/adb-converter/ts/src/adbauthor.ts';
import { encodeXmlAttr, encodeXmlText } from 'D:/2026/adb-converter/ts/src/xml-entities.ts';
import { AdbReader, SyncIO } from 'D:/2026/adb-converter/ts/src/accelon26/adb.ts';
import { VaPaMapper } from 'D:/2026/adb-converter/ts/src/accelon26/vapa.ts';
import { nodeAnchorInfo, anchorVa } from 'D:/2026/adb-converter/ts/src/accelon26/page-text.ts';

const ROOT = 'D:/2026/yogacarabhumi-dila';
const OUTDIR = 'D:/2026/_scratch-ybh/ybh';
fs.mkdirSync(OUTDIR, { recursive: true });

// 漢文著作（權威略符表）：代號 → 書名；順序即目錄順序
const WORKS: [string, string][] = [
  ['T1579', '瑜伽師地論'], ['PXJ-H', '瑜伽師地論科句披尋記'], ['T1580', '瑜伽師地論釋'],
  ['T1828', '瑜伽論記'], ['T1829', '瑜伽師地論略纂'], ['T2801', '瑜伽論分門記'], ['T2802', '瑜伽論手記'],
  ['T2259', '瑜伽論問答'], ['T1581', '菩薩地持經'], ['T1582', '菩薩善戒經'], ['T1583', '菩薩受戒法'],
  ['T1584', '決定藏論'], ['T1602', '顯揚聖教論'], ['T1604', '大乘莊嚴經論'],
  ['T1605', '大乘阿毘達磨集論'], ['T1606', '大乘阿毘達磨雜集論'], ['X0794', '劫章頌'],
  // T0099 雜阿含經：作者 2026-11-12 定案不收（獨立阿含部，非本地分引文範圍）
];
const CN = new Set(WORKS.map(w => w[0]));
const seriesOf = (b: string) => (b.match(/^(.*)-(?:\d+|k|a)$/) || [, b])[1];
// v5：每部著作一棵科判樹＝目錄一個頁籤（作者 2026-11-13：科判也是一顆樹）。
// 標籤家族：科＋一字＋層號（T1579 沿用既有的 科NN，不動舊錨點）。
const FAM: Record<string, string> = {
  T1579: '', 'PXJ-H': '漢', T1580: '釋', T1828: '遁', T1829: '基', T2801: '分', T2802: '手',
  T2259: '問', T1581: '持', T1582: '戒', T1583: '受', T1584: '決', T1602: '揚', T1604: '莊',
  T1605: '集', T1606: '雜', X0794: '劫',
};

// v15.3：大綱檔（-k）自成一族「綱」——實測其 a1 重啟 190 次、大寫鏈與小寫鏈交錯、
// 全無 kpD：父層資訊在源檔已失，硬掛主樹會造出 462 個假兄弟。綱族獨立一頁籤，
// 標「平列」如實呈現；各著作科判頁籤只收真 kpD 樹。
// v15.4：大綱頁籤每部一個（使用者：不要全部平列一起）。字族「大＋本部字」
// （T1579→科大、披尋記→科大漢…），與主樹字族不撞；父層已失源檔，頁籤名保留「平列」誠實標註。
const famOf = (p: { ser: string; kind: string }): string => p.kind === 'k' ? '大' + (FAM[p.ser] ?? '') : (FAM[p.ser] ?? '');

// ---- 錨點索引（前置掃描）：實測 kpD 卷內唯一、跨卷重號（編號每卷重排）----
const kpVols = new Map<string, Set<string>>();   // `${ser}#${kp}` → 出現的檔案 base 集合
const baseKps = new Set<string>();               // `${base}#${kp}`
const appDefs = new Set<string>();               // `${base}#${appID}`（-a 校勘記行尾 ^app… 定義；權威源 xml-p5\T）

// ---- 選檔 + 語言覆核 ----
const all = fs.readdirSync(ROOT).filter(f => f.endsWith('.md'));
const picked: { file: string; base: string; ser: string; vol: number; kind: 'main' | 'k' | 'a' }[] = [];
const rejected: string[] = [];
for (const f of all) {
  const base = f.replace(/\.md$/, '');
  const ser = seriesOf(base);
  if (!CN.has(ser)) { rejected.push(base); continue; }
  const m = base.match(/-(\d+)$/);
  picked.push({ file: f, base, ser, vol: m ? +m[1] : (/-k$/.test(base) ? 1e9 : 1e9 - 1), kind: m ? 'main' : (/-k$/.test(base) ? 'k' : 'a') });
}
// 語言覆核：漢文檔的 CJK 佔比應壓倒性
const langReport: string[] = [];
for (const p of picked) {
  const t = fs.readFileSync(path.join(ROOT, p.file), 'utf8');
  const cjk = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  const tib = (t.match(/[\u0f00-\u0fff]/g) || []).length;
  const lat = (t.match(/[A-Za-z]/g) || []).length;
  const tot = cjk + tib + lat || 1;
  if (cjk / tot < 0.8) langReport.push(`${p.base}: CJK ${(100 * cjk / tot).toFixed(1)}% tib ${tib} lat ${lat}`);
}

// 前置掃描：只認「標題行定義」的 kpD（引用不算定義），供嵌/文字判定與驗收用
const maxLevel = new Map<string, number>();   // ser → 用到的最深科判層（1..54）
function headTier(title: string, hashes: number): number {
  const am = /\^(kpD(\d+)-\d+)/.exec(title);
  if (am) return Math.max(1, Math.min(54, +am[2]!));
  const tt = title.trim();
  const lm = /^([A-Z])\d/.exec(tt);
  if (lm) return Math.max(1, Math.min(54, lm[1]!.charCodeAt(0) - 64));
  // PXJ-H-k 大綱制：數字（1 本地分…）＝第一層；小寫字母 a/b/c＝第二層起
  const sm = /^([a-z])\d*[ .、]/.exec(tt);
  if (sm) return Math.max(1, Math.min(54, 2 + sm[1]!.charCodeAt(0) - 97));
  if (/^[0-9]+[ .、]/.test(tt)) return 1;
  return Math.max(1, Math.min(54, hashes));
}
for (const p of picked) {
  const t = fs.readFileSync(path.join(ROOT, p.file), 'utf8');
  for (const m of t.matchAll(/^#{1,6} .*?\^(kpD\d+-\d+)\s*$/gm)) {
    kpVols.set(`${p.ser}#${m[1]}`, (kpVols.get(`${p.ser}#${m[1]}`) ?? new Set()).add(p.base));
    baseKps.add(`${p.base}#${m[1]}`);
  }
  for (const m of t.matchAll(/\^(app[A-Za-z0-9_-]+)\s*$/gm)) appDefs.add(`${p.base}#${m[1]}`);
  for (const m of t.matchAll(/^(#{1,6})\s+(.*)$/gm)) {
    const lv = headTier(m[2]!, m[1]!.length);
    maxLevel.set(famOf(p), Math.max(maxLevel.get(famOf(p)) ?? 0, lv));
  }
}
let jieCnt = 0, textCnt = 0, anchorCnt = 0;

// v16 鏡像還原：等長且正規化標題吻合 ≥95% 的部，大綱逐行改用主卷的真 tier（父層復活）；
// 不合格者保留 v15 推導制式＋「平列」標籤。大綱節點一律不掛錨（同 work NS 同值會與主卷
// 節點在 nsMap 撞鍵、後寫覆寫，指錯）。
const mirrorNorm = (s: string) => s
  .replace(/\^kp[#A-Za-z0-9_-]+/g, '')
  .replace(/^\s*(?:[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥][一二三四五六七八九十]{1,3}、|[A-Za-z][0-9]*[ .、]?)/, '')
  .replace(/[0-9０-９\s　、，。：；（）()·「」『』?？]/g, '').slice(0, 10);
const outlineTiers = new Map<string, number[]>();   // ser → 大綱每行 tier（鏡像合格＝主卷序列）
const mirrorOK = new Map<string, boolean>();
for (const [ser] of WORKS) {
  const kf = picked.find(p => p.ser === ser && p.kind === 'k');
  if (!kf) continue;
  const kl: number[] = []; const kt: string[] = [];
  for (const m of fs.readFileSync(path.join(ROOT, kf.file), 'utf8').matchAll(/^(#{1,6})\s+(.*)$/gm)) {
    kl.push(headTier(m[2]!, m[1]!.length)); kt.push(mirrorNorm(m[2]!));
  }
  const mt: string[] = []; const msT: number[] = [];
  for (const p of picked.filter(p2 => p2.ser === ser && p2.kind === 'main').sort((a, b) => a.vol - b.vol)) {
    for (const m of fs.readFileSync(path.join(ROOT, p.file), 'utf8').matchAll(/^(#{1,6})\s+(.*)$/gm)) {
      msT.push(headTier(m[2]!, m[1]!.length)); mt.push(mirrorNorm(m[2]!));
    }
  }
  let ok = false;
  if (kt.length && kt.length === mt.length) {
    let same = 0;
    for (let i = 0; i < kt.length; i++) if (mt[i] && mt[i] === kt[i]) same++;
    ok = 100 * same / kt.length >= 95;
  }
  mirrorOK.set(ser, ok);
  outlineTiers.set(ser, ok ? msT : kl);
  const ofam = '大' + (FAM[ser] ?? '');
  maxLevel.set(ofam, Math.max(...(ok ? msT : kl), 1));
}
console.log('鏡像合格（掛回真父層）:', WORKS.filter(([s]) => mirrorOK.get(s)).map(([s]) => s).join(' ') || '無');

// v5.1（UI buildTree 嵌套規則）：父節點必須用「自己的 t=」宣告子鏈，否則子層淪為根級平舖。
// 章 按所属著作宣告該家族科判鏈；科X01 宣告 科X02…（T1579 家族無字 = 科01…）。
function famChain(ser: string): string {
  const fam = FAM[ser] ?? '';
  const mx = maxLevel.get(ser) ?? 0;
  if (!mx) return '';
  return Array.from({ length: mx }, (_, i) => '科' + fam + String(i + 1).padStart(2, '0')).join(',') + '.';
}
function famChildChain(fam: string): string {
  const mx = maxLevel.get(fam) ?? 0;
  if (mx < 2) return '';
  return Array.from({ length: mx - 1 }, (_, i) => '科' + fam + String(i + 2).padStart(2, '0')).join(',') + '.';
}
const CHAIN: Record<string, string> = {};
for (const [ser] of WORKS) CHAIN[ser] = famChain(ser);

// P1/P1b span 表：T1579 與披尋記科判 → CBETA 頁欄＋行內 j（span-index.ts 產出）
const spans = new Map<string, { page: string; js: string; je: string; mode: string }>();
{
  const sp = 'D:/2026/_scratch-ybh/spans-j-verified.tsv';
  if (fs.existsSync(sp)) {
    for (const r of fs.readFileSync(sp, 'utf8').split('\n').slice(1)) {
      const c = r.split('\t');
      if (c.length >= 4 && c[3] && (c[0] === 'T1579' || c[0] === 'PXJ')) spans.set(`${c[1]}#${c[2]}`, { page: c[3]!, js: c[4] ?? '', je: c[5] ?? '', mode: c[6] ?? '' });
    }
  }
}
let taishoCnt = 0, embedJCnt = 0, kepanZhuCnt = 0;

// P2 注文段落 ref：注文各部釋文段 → 所釋原文 span（v18 一般化，取代 v17 只論釋一部）。
// 三层由 span-build-zhu.ts（D 現掛／LCS 科判對齊／同子樹取窗／祖先繼承）＋ span-zhu.ts（A·K·Q 合併）產出：
// 論釋等大部是義引，逐字只偶爾出現，故段落錨到所在科判的原文窗；窗全部沿用 spans-j-verified.tsv 已逐條驗過的座標。
const prefs = new Map<string, Map<number, { page: string; js: string; je: string; mode: string }>>();
let paraRefCnt = 0;
{
  const dir = 'D:/2026/_scratch-ybh';
  for (const f of fs.readdirSync(dir).filter((x) => /^zhu-refs-.+\.tsv$/.test(x)).sort()) {
    for (const r of fs.readFileSync(`${dir}/${f}`, 'utf8').split('\n').slice(1)) {
      const c = r.split('\t');
      if (c.length < 8 || !c[0] || !c[3]) continue;
      const mode = c[6] ?? '';
      if (mode === 'none' || mode === 'drop' || mode === 'dup') continue;     // 無錨／寧缺／重複者不出鏈
      const m = prefs.get(c[0]!) ?? new Map<number, { page: string; js: string; je: string; mode: string }>();
      m.set(+c[1]! - 1, { page: c[3]!, js: c[4] === '-1' ? '' : (c[4] ?? ''), je: c[5] === '-1' ? '' : (c[5] ?? ''), mode });
      prefs.set(c[0]!, m);
    }
  }
}

// P1 收尾（v19）：其餘 14 個科判家族的科判行也掛 CBETA 聯＋嵌——用 zhu-spans-*.json 的
// 「細窗」（mode 非 K/no：D 書內現掛、LCS 對齊、缺口填補、子樹取窗）。粗窗（祖先繼承 K）不掛：
// 會與祖先行的窗重複，且樹上滿是同一窗的晶片；粗窗的閱讀需求已由段落層（zhu-refs）覆蓋。
const zhuSpans = new Map<string, { page: string; js: string; je: string; mode: string }>();
{
  const dir = 'D:/2026/_scratch-ybh';
  for (const f of fs.readdirSync(dir).filter((x) => /^zhu-spans-.+\.json$/.test(x)).sort()) {
    for (const r of JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')) as { base: string; kp: string; page: string; js: number; je: number; mode: string }[]) {
      if (r.js >= 0 && r.mode !== 'K' && r.mode !== 'no') zhuSpans.set(`${r.base}#${r.kp}`, { page: r.page, js: String(r.js), je: String(r.je), mode: r.mode });
    }
  }
}

// P4 融視圖（v23）：科文／注文的科判行另發一枚 `<融 i="ybh?T1579-N#kpD…">`，
// 讓「以科文融合顯示」開關（母區 6e34bca／localStorage accelon26.fusionView）把**同一份論本**
// 就地填入——讀任何一套科判都能看到論文本體，論本文字不被複製（standoff）。
// 形態經 test-fusion-form.ts 實測定案：① **必須成對** `<融 …></融>`（自閉合會讓渲染器輸出未閉合 <span>）；
// ② 內容留空＝OFF 時零視覺負擔（渲染器直接 continue），ON 時由 fusion-view 填 span；
// ③ `max` 是「行」預算而非字元（實測 max=200 可拉到 1.7 萬字），定 max=24 → 填字分佈 100–1,200、
//    中位數約 400，配合已落地的 R6「繼續展開」當逃生口。
// 只發細對齊者（mode 非 K/no）：祖先繼承的粗窗融合出來會整片重複。
const fusions = new Map<string, { nodeKey: string; label: string }>();
{
  const dir = 'D:/2026/_scratch-ybh';
  for (const f of fs.readdirSync(dir).filter((x) => /^zhu-spans-.+\.json$/.test(x)).sort()) {
    for (const r of JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')) as { base: string; kp: string; mode: string; nodeKey?: string; title?: string }[]) {
      if (!r.nodeKey || r.mode === 'K' || r.mode === 'no') continue;
      if (r.nodeKey === `${r.base}#${r.kp}`) continue;              // 指向自己不發
      fusions.set(`${r.base}#${r.kp}`, { nodeKey: r.nodeKey, label: r.title ?? '' });
    }
  }
}
let fusionCnt = 0;

// 展示端去重：同卷內「同一窗連著發」只留第一次（科判繼承會讓整部書數百段共用同一大綱窗，
// 如《手記》429 段全落在 30p395c#56-304）；資料表 zhu-refs-*.tsv 仍保留逐段真相，只在建庫時收攏。
const lastRef = new Map<string, string>();
let paraDupCnt = 0;
const shipped: string[] = ['base\tline\tmode\tkey'];

// ---- 行轉換 ----
const esc = encodeXmlText;
function inline(s: string): string {
  let out = '';
  let last = 0;
  // wikilink（含錨點）、markdown 連結、腳註引用
  const re = /\[\[([^\]|#]+)(?:#([^\]|]*))?(?:\|([^\]]*))?\]\]|\[([^\]]+)\]\(([^)]+)\)|\[\^([^\]]+)\]/g;
  for (const m of s.matchAll(re)) {
    out += esc(s.slice(last, m.index));
    last = m.index + m[0].length;
    if (m[1] !== undefined) {
      const target = m[1].trim();
      const anchor = (m[2] || '').replace(/^\^/, '').trim();
      const label = (m[3] || target).trim();
      const tSer = seriesOf(target);
      const cleanAnchor = anchor.split(/[\s"]/)[0]!;   // 擋下 CT 系帶屬性的錨（app805_4" data-page=…）
      if (/^kpD\d+-\d+$/.test(cleanAnchor) && CN.has(tSer)) {
        if (baseKps.has(`${target}#${cleanAnchor}`)) {
          // 目標卷自身定義 → 卷級 節聯（精確、輕量捲動；嵌保留給未來 科文→原文）
          out += `<節聯 n="${encodeXmlAttr(target + '#' + cleanAnchor)}">${esc(label)}</節聯>`;
          jieCnt++;
        } else if ((kpVols.get(`${tSer}#${cleanAnchor}`) ?? new Set()).size === 1) {
          out += `<節聯 n="${encodeXmlAttr(tSer + '#' + cleanAnchor)}">${esc(label)}</節聯>`;
          jieCnt++;
        } else {
          out += `《${esc(label)}》〔${esc(target)}#${esc(cleanAnchor)}〕`;
          textCnt++;
        }
      } else if (/^app[A-Za-z0-9_-]+$/.test(cleanAnchor) && CN.has(tSer) && appDefs.has(`${target}#${cleanAnchor}`)) {
        // 校注引用 → 節聯到 -a 檔的 <錨>（DILA 轉錄自 CBETA xml-p5\T，ID 同鍵）
        out += `<節聯 n="${encodeXmlAttr(target + '#' + cleanAnchor)}">${esc(label)}</節聯>`;
        jieCnt++;
      } else if (!CN.has(tSer)) {
        // v10：梵漢（未入庫系列）鏈結先不進 adb（作者 2026-11-13 定案）。
        // 哨兵 \u0001 由 bodyLines 剝除，連外圍《》一併吞掉，不留空書名號。
        out += '\u0001';
        delRefCnt++;
      } else {
        out += `《${esc(label)}》〔${esc(target)}${anchor ? '#' + esc(cleanAnchor) : ''}〕`;
        textCnt++;
      }
    } else if (m[4] !== undefined) {
      // markdown 連結：只留顯示文字（梵本對照等外部檔不在本庫，不發死連結）
      const label = m[4].trim(); const url = (m[5] || '').trim();
      out += /skt|samahita/i.test(url) ? `〔梵本對照 ${esc(label.replace(/^samāhitā bhūmiḥ skt#?/, '§'))}〕` : `《${esc(label)}》`;
    } else if (m[6] !== undefined) {
      out += `<註 n="${encodeXmlAttr(m[6].trim())}"/>`;
    }
  }
  out += esc(s.slice(last));
  return out;
}
// ---- v8 科文互鏈（方案 A）：正文天干地支科號 → <節聯> 指回本卷標題節點 ----
const GAN = '甲乙丙丁戊己庚辛壬癸';
const ZHI = '子丑寅卯辰巳午未申酉戌亥';
const tierOfChar = (c: string): number => { const g = GAN.indexOf(c); if (g >= 0) return g + 1; const z = ZHI.indexOf(c); return z >= 0 ? z + 11 : 0; };
function cnParse(t: string): number {
  const U = '一二三四五六七八九';
  if (!t) return 0;
  if (t === '十') return 10;
  let m = /^十(.)$/.exec(t); if (m) { const i = U.indexOf(m[1]!); return i >= 0 ? 10 + i + 1 : 0; }
  m = /^(.)十(.?)$/.exec(t); if (m) { const a = U.indexOf(m[1]!) + 1; if (a < 1) return 0; const u = m[2] ? U.indexOf(m[2]!) + 1 : 0; return a * 10 + u; }
  if (t.length === 1) { const i = U.indexOf(t); return i >= 0 ? i + 1 : 0; }
  return 0;
}
let kemonCnt = 0;
const KEMON_RE = /^([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])([一二三四五六七八九十]{1,3})、(.*)$/;
let renameCnt = 0;
let delRefCnt = 0, selfMergeCnt = 0;

// v10：剝哨兵（未入庫系列引用），連外圍《》一併吞
function postInline(s: string): string {
  return s.replace(/《\u0001》/g, '').replace(/\u0001/g, '');
}
function bodyLines(text: string, fam: string, childChain: string, base: string, mirror?: number[]): string[] {
  let mi = 0;
  // 兩趟（v8.1）：天干地支序號是「父內」編號（每換一個上級父即復位），不等於 kpD 卷內流水號，
  // 故先按標題縮排做樹走訪重算父內序，得 (tier, 父內序) → 標題；再逐段匹配（同序多候選時比標題文字）。
  const rawLines = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n');
  type Hd = { tier: number; seqInVol: number; anchor: string; title: string; seqInParent: number; lineIdx: number };
  const hds: Hd[] = [];
  rawLines.forEach((ln, li) => {
    const hm = /^(#{1,6})\s+(.*)$/.exec(ln);
    if (!hm) return;
    const am2 = /\^(kpD(\d+)-(\d+))/.exec(hm[2]!);
    if (!am2) return;
    const tt = hm[2]!.replace(/\s*\^kpD\d+-\d+\s*$/, '').replace(/\^kp#[^\s（]*/g, '').trim();
    hds.push({
      tier: +am2[2]!, seqInVol: +am2[3]!, anchor: am2[1]!,
      title: tt.replace(/^[A-Z]?\d*\s*/, '').trim(), seqInParent: 0, lineIdx: li,
    });
  });
  {
    const stack: Hd[] = [];
    const cnt = new Map<number, number>();
    for (const h of hds) {
      while (stack.length && stack[stack.length - 1]!.tier >= h.tier) stack.pop();
      stack.push(h);
      cnt.set(h.tier, (cnt.get(h.tier) ?? 0) + 1);
      for (let t2 = h.tier + 1; t2 <= 60; t2++) if (cnt.has(t2)) cnt.set(t2, 0);
      h.seqInParent = cnt.get(h.tier) ?? 1;
    }
  }
  const byKey = new Map<string, Hd[]>();
  for (const h of hds) {
    const k = `${h.tier}-${h.seqInParent}`;
    (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(h);
  }
  // v9 認領趟：先於輸出跑完全檔鏈行，得 anchor → 干支標籤（「丙二、」含逗號）。
  // 主路＝(tier,父內序)＋標題前綴＋行距最近；④修正＝同層標題優先反查（限 30 行內）。
  const labelOf = new Map<string, string>();
  const nearest = (list: Hd[], li: number): Hd =>
    list.reduce((a, b) => (Math.abs(b.lineIdx - li) < Math.abs(a.lineIdx - li) ? b : a));
  rawLines.forEach((ln, li) => {
    if (/^#/.test(ln) || /^\[\^/.test(ln) || /^《/.test(ln)) return;
    for (const seg of ln.split('　')) {
      const m = KEMON_RE.exec(seg.trim());
      if (!m) continue;
      const tier = tierOfChar(m[1]!); const seq = cnParse(m[2]!);
      const rest = m[3]!.trim();
      const label = m[1]! + m[2]! + '、';
      let h: Hd | undefined;
      const cands = tier && seq ? byKey.get(`${tier}-${seq}`) : undefined;
      if (cands?.length) {
        const good = cands.filter((c) => c.title && rest.startsWith(c.title));
        if (good.length) h = nearest(good, li);
      }
      if (!h && tier) {   // ④：號錯位時退而求其次——同層、標題文字吻合、30 行內
        const alt = hds.filter((c) => c.tier === tier && c.title && rest.startsWith(c.title) && Math.abs(c.lineIdx - li) <= 30);
        if (alt.length) h = nearest(alt, li);
      }
      if (h && !labelOf.has(h.anchor)) labelOf.set(h.anchor, label);
    }
  });
  function kemonLink(line: string, li: number): string {
    const segs = line.split('　');
    let hit = false, sawSelf = false;
    const outSegs = segs.map((seg) => {
      const m = /^([甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥])([一二三四五六七八九十]{1,3})、(.*)$/.exec(seg.trim());
      if (!m) return seg;
      const tier = tierOfChar(m[1]!); const seq = cnParse(m[2]!);
      const cands = tier && seq ? byKey.get(`${tier}-${seq}`) : undefined;
      if (!cands?.length) return seg;
      const rest = m[3]!.trim();
      const good = cands.filter((c) => c.title && rest.startsWith(c.title));
      if (!good.length) return seg;
      const h = good.reduce((a, b) => (Math.abs(b.lineIdx - li) < Math.abs(a.lineIdx - li) ? b : a));
      // v10 合併：段指向的標題就在本行 ±3 行內（即該行的「現行科」）→ 標題自己已是節聯，
      // 此段不再包聯；若整行只有現行科（純自指鏈行）→ 整行刪除，信息併進標題。
      if (Math.abs(h.lineIdx - li) <= 12) { sawSelf = true; return seg; }
      const cut = seg.indexOf(h.title) + h.title.length;
      hit = true; kemonCnt++;
      return `<節聯 n="${encodeXmlAttr(base + '#' + h.anchor)}">${seg.slice(0, cut)}</節聯>${seg.slice(cut)}`;
    });
    if (sawSelf && !hit) { selfMergeCnt++; return ''; }
    return hit ? outSegs.join('　') : line;
  }
  const out: string[] = [];
  let rawLi = -1;
  for (const raw of text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').split('\n')) {
    rawLi++;
    let ln = raw;
    // 腳註定義 [^n]: body → <釋 n="n">body</釋>
    const fd = ln.match(/^\s*\[\^([^\]]+)\]:\s?(.*)$/);
    if (fd) { out.push(`<釋 n="${encodeXmlAttr(fd[1].trim())}">${postInline(inline(fd[2]))}</釋>`); continue; }
    // 標題（可能帶 kpD 錨點）→ 科判樹節點；深度用 kpD tier（無 kpD 時退回 markdown 層級）
    const hd = ln.match(/^(#{1,6})\s+(.*)$/);
    if (hd) {
      let t = hd[2];
      const am = t.match(/\^(kpD(\d+)-(\d+))/);
      const anchor = am ? am[1] : '';
      // 深度：與 headTier 同口径（kpD tier → 字母前綴 → markdown 層級），家族前綴分樹
      const tier = mirror && mi < mirror.length ? mirror[mi++] : headTier(t, hd[1].length);
      if (!mirror) mi++;
      const tag = '科' + fam + String(tier).padStart(2, '0');
      // 家族根層（01）自宣告子鏈：UI buildTree 只認父實例的 t=，不然子層會淪為根級平舖
      const selfT = tier === 1 && childChain ? ` t="${encodeXmlAttr(childChain)}"` : '';
      t = t.replace(/\s*\^kpD\d+-\d+\s*$/, '').replace(/\^kp#[^\s（]*/g, '').trim();
      // v9：披尋記標題改用原書干支寫法；字母退入 a= 屬性（不顯示、可查、可回退）。
      // 匹配口徑與認領趟一致：先剝字母前綴得純標題再比對。
      const bareTitle = t.replace(/^[A-Z]?\d*\s*/, '').trim();
      const letter = (/^([A-Z]?\d*)\s*/.exec(t) || ['', ''])[1];
      const gz = fam === '漢' && anchor ? labelOf.get(anchor) : undefined;
      const disp = gz ? gz + bareTitle : t;
      if (gz) renameCnt++;
      const aAttr = gz && letter ? ` a="${encodeXmlAttr(letter)}"` : '';
      // v10：標題自掛節聯＝點標題即捲動＋目錄游標同步（「點回同步樹」），鏈行自指段因此可併掉
      let body = postInline(inline(disp));
      if (anchor) { body = `<節聯 n="${encodeXmlAttr(base + '#' + anchor)}">${body}</節聯>`; jieCnt++; }
      // P1/P1b：T1579 與披尋記科判掛 CBETA 原文（聯=跳看＋反鏈；嵌 j=行內速覽）
      // v19：其餘 14 家族用 zhu-spans 細窗補齊（P1 收尾）；粗窗（K）不掛，見上註
      const sp = (fam === '' || fam === '漢') && anchor ? spans.get(`${base}#${anchor}`)
        : anchor ? zhuSpans.get(`${base}#${anchor}`) : undefined;
      if (sp && !(fam === '' || fam === '漢')) kepanZhuCnt++;
      let tail = '';
      if (sp) {
        // v14：有 j 窗者聯升級 #a-b（跨庫精確定位＋高亮）；插值/無窗者留純頁欄
        // v18 修：`js && je` 會把 js==='0'（如 30p478b#0-80 卷首窗）誤當無窗 → 改字串空值判斷
        const hasWin = sp.js !== '' && sp.je !== '';
        const linkTo = hasWin ? `${sp.page}#${sp.js}-${sp.je}` : sp.page;
        tail = `<聯 i="taisho?${encodeXmlAttr(linkTo)}">CBETA</聯>`;
        taishoCnt++;
        if (hasWin) { tail += `<嵌 i="taisho?${encodeXmlAttr(sp.page)}" j="${sp.js}-${sp.je}" n="原文"/>`; embedJCnt++; }
      }
      out.push(anchor ? `<${tag}${selfT} n="${encodeXmlAttr(anchor)}"${aAttr}>${body}</${tag}>` : `<${tag}${selfT}>${body}</${tag}>`);
      // v15.2：CBETA 聯/嵌移獨立行——併在標題行會被目錄 label 抽取連文字吞進標題（「甲三、攝釋分CBETA」）
      if (sp) out.push(tail.trim());
      // P4：<融> 也走獨立行、**成對且留空**（形態經 test-fusion-form.ts 實證）
      if (anchor) {
        const fu = fusions.get(`${base}#${anchor}`);
        if (fu) {
          out.push(`<融 i="ybh?${encodeXmlAttr(fu.nodeKey)}" n="論文・${encodeXmlAttr(fu.label)}" max="24"></融>`);
          fusionCnt++;
        }
      }
      continue;
    }
    // 校勘附編（-a）定義行：行尾 ` ^appID` → 行首 <錨 n/>，讓校注引用有落點（v7）
    const ad = /^(?!#)(.*?)\s*\^(app[A-Za-z0-9_-]+)\s*$/.exec(ln);
    if (ad && ad[2]) {
      out.push(`<錨 n="${encodeXmlAttr(ad[2])}"/>` + inline(ad[1]!));
      anchorCnt++;
      continue;
    }
    // 去掉 markdown 粗體/斜體/行內碼標記（保留文字）
    ln = ln.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1').replace(/`([^`]+)`/g, '$1');
    const t = postInline(inline(ln)).replace(/[ \t]+$/, '');
    out.push(t.trim() ? kemonLink(t, rawLi) : t);
    // P2：注文段落 ref——獨立行（v15.2 教訓：不可併入正文行，會被上層抽取吞進文字）
    if (t.trim()) {
      const pr = prefs.get(base)?.get(rawLi);
      if (pr) {
        const hasWin = pr.js !== '' && pr.je !== '';           // 注意 '0' 起點（如 30p478b#0-80）不可當 falsy 略過
        const key = hasWin ? `${pr.page}#${pr.js}-${pr.je}` : pr.page;
        if (key === lastRef.get(base)) paraDupCnt++;           // 同窗連發只留第一次（科判繼承常成串重複）
        else {
          lastRef.set(base, key);
          const linkTo = hasWin ? `${pr.page}#${pr.js}-${pr.je}` : pr.page;
          let tl = `<聯 i="taisho?${encodeXmlAttr(linkTo)}">所釋</聯>`;
          taishoCnt++; paraRefCnt++;
          if (hasWin) { tl += `<嵌 i="taisho?${encodeXmlAttr(pr.page)}" j="${pr.js}-${pr.je}" n="論文"/>`; embedJCnt++; }
          out.push(tl);
          shipped.push([base, rawLi + 1, pr.mode, key].join('\t'));
        }
      }
    }
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out;
}

// ---- 組裝 ----
// 科判樹：篇＞章＞科01…科54（深度＝kpD tier）。照 taisho 模式：樹 t= 一次宣告全部層級，
// 末端層級加 '.'；l= 列葉內容標籤（腳註）。內容標籤自己不帶 t=。
const KE_TIERS = Array.from({ length: 54 }, (_, i) => '科' + String(i + 1).padStart(2, '0')).join(',');
const lines: string[] = [];
lines.push(`<集 t="集">${esc('瑜伽師地論漢文集成')}</集>`);
// v15.1：總目錄頁籤用獨立小詞彙（書目,卷次）——loadTree 鏈展開只讀本樹詞彙內的實例，
// 讀不到 篇.t 的科判大鏈 → 開庫瞬間 377 行即見書目卷次（純資料端，不依賴 R8）。
// 書目/卷次 是 篇/章 行內零寬自閉合標記（不影響渲染），卷次掛在 書目 下（書目 t="卷次."）。
lines.push(`<隱><樹 s="*" t="書目,卷次.">總目錄</樹></隱>`);
lines.push(`<隱><樹 s="*" l="註,釋" t="篇,章,${KE_TIERS}.">瑜伽師地論科判</樹></隱>`);
for (const [ser, name] of WORKS) {
  const fam = FAM[ser];
  if (!fam) continue;                       // T1579 已在主樹
  const mx = maxLevel.get(fam) ?? 0;
  if (!mx) continue;
  const tiers = Array.from({ length: mx }, (_, i) => '科' + fam + String(i + 1).padStart(2, '0')).join(',');
  lines.push(`<隱><樹 s="*" t="${tiers}.">${esc(name)}科判</樹></隱>`);
}
// v16：鏡像合格部掛回真父層（頁籤名去「平列」）；不合格者保留推導制式＋平列註記
for (const [ser, name] of WORKS) {
  const ofam = '大' + (FAM[ser] ?? '');
  const mx = maxLevel.get(ofam) ?? 0;
  if (!mx) continue;
  const tiers = Array.from({ length: mx }, (_, i) => '科' + ofam + String(i + 1).padStart(2, '0')).join(',');
  lines.push(`<隱><樹 s="*" t="${tiers}.">${esc(name)}大綱${mirrorOK.get(ser) ? '' : '（平列）'}</樹></隱>`);
}
const stats: string[] = [];
let totalJie = 0, totalNotes = 0;
for (const [ser, name] of WORKS) {
  const files = picked.filter(p => p.ser === ser).sort((a, b) => a.vol - b.vol);
  if (!files.length) continue;
  lines.push('');
  lines.push(`<篇 id="${encodeXmlAttr(ser)}" t="章,${KE_TIERS}"><書目 id="${encodeXmlAttr(ser)}" t="卷次."/>${esc(name)}（${esc(ser)}）</篇>`);
  let nchap = 0;
  for (const p of files) {
    const label = p.kind === 'main' ? `卷第${p.vol}` : p.kind === 'k' ? '科判大綱' : '校勘附編';
    // v14.2：章不再宣告子鏈——鏈由 篇 自宣告（封閉詞彙），主樹不再經 章.t 把 16 個
    // 家族鏈全拉進來（170k 行 → ~12k）。家族樹的嵌套靠 科X01 自宣告子鏈，不受影響。
    lines.push(`<章 id="${encodeXmlAttr(p.base)}"><卷次 id="${encodeXmlAttr(p.base)}"/>${esc(label)}</章>`);
    const bl = bodyLines(fs.readFileSync(path.join(ROOT, p.file), 'utf8'), famOf(p), famChildChain(famOf(p)), p.base, p.kind === 'k' ? outlineTiers.get(ser) : undefined);
    totalJie += bl.filter(x => /^<科[一-鿿]?\d\d/.test(x)).length;
    totalNotes += bl.filter(x => x.startsWith('<釋')).length;
    for (const l of bl) lines.push(l);
    nchap++;
  }
  stats.push(`${ser} ${name}: ${nchap} 章`);
}

console.log('=== 選檔 ===');
console.log('  漢文系列', WORKS.length, '選入檔案', picked.length, '排除', rejected.length);
console.log('  語言覆核异常（CJK<80%）:', langReport.length ? langReport.join(' | ') : '無');
console.log('  節(科判標題)', totalJie, '釋(腳註)', totalNotes, '總行', lines.length);
fs.writeFileSync(path.join(OUTDIR, 'ybh.xml'), lines.join('\n'), 'utf8');
fs.writeFileSync(path.join(OUTDIR, 'build-report.txt'),
  ['選入 ' + picked.length + ' 檔，排除 ' + rejected.length, '語言异常: ' + (langReport.join(' | ') || '無'),
   '節 ' + totalJie + ' 釋 ' + totalNotes + ' 行 ' + lines.length, ...stats].join('\n'), 'utf8');
// 實際入庫的段落 ref 清單（展示端去重後）——驗收腳本以此為準逐條回讀
fs.writeFileSync('D:/2026/_scratch-ybh/zhu-refs-shipped.tsv', shipped.join('\n') + '\n', 'utf8');

const t0 = Date.now();
const res = await authorAdb({
  dbname: 'ybh', dbcname: '瑜伽師地論漢文集成', lines,
  dropNumeric: true,
  log: (m) => console.log('  ' + m),
});
const out = path.join(OUTDIR, 'ybh.adb');
fs.writeFileSync(out, res.file);
console.log(`built ${out}: ${(res.file.length / 1048576).toFixed(2)} MiB in ${Date.now() - t0} ms — ${res.lines} lines, ${res.tokens} tokens, tags: ${res.tagNames.join(' ')}`);
console.log('cachedKeys:', res.cachedKeys.join(' '));
console.log(`互鏈：節聯 ${jieCnt}、CBETA 聯 ${taishoCnt}（科判行 ${taishoCnt - paraRefCnt}＝v19 新增他家族 ${kepanZhuCnt}＋注文段落 ref ${paraRefCnt}，另收攏同窗重複 ${paraDupCnt}）、CBETA 行內嵌 ${embedJCnt}、**P4 <融> ${fusionCnt} 枚**、自指鏈行併除 ${selfMergeCnt}、梵漢剝除 ${delRefCnt}、文字 ${textCnt}、<錨> ${anchorCnt}、干支改名 ${renameCnt}`);

// ---- 產後驗收（驗收腳本本身也要被驗）：錨點逐條解析＋節點行核對＋已知負控 ----
{
  const rd = await AdbReader.open(new SyncIO(out));
  const mp = new VaPaMapper(rd);
  await mp.init();
  const tagsC = rd.containers.get('tags')!;
  const pianVa = await rd.decodeBlockList('tags', tagsC.names.indexOf('篇'));
  const chapVa = await rd.decodeBlockList('tags', tagsC.names.indexOf('章'));
  const chapLine = chapVa.map((v) => mp.edgeLine(v));

  // works.tsv：篇 VA/行＋卷數（章 VA 落在篇區間內）
  const wk = ['code\ttitle\tpianVA\tpianLine\tchapters'];
  WORKS.forEach(([ser, name], i) => {
    const lo = pianVa[i]!, hi = i + 1 < pianVa.length ? pianVa[i + 1]! : Infinity;
    const nc = chapVa.filter((v) => v >= lo && v < hi).length;
    wk.push(`${ser}\t${name}\t${lo}\t${mp.edgeLine(lo)}\t${nc}`);
  });
  fs.writeFileSync(path.join(OUTDIR, 'works.tsv'), wk.join('\n'), 'utf8');

  // anchor-check.tsv：每個 節聯/嵌 目標 (1) 解析出 VA (2) 該 VA 的行含 n="值"（科 或 錨 通用）
  const counts = new Map<string, number>();
  for (const m of lines.join('\n').matchAll(/<節聯 n="([^"]+)"|<嵌 i="ybh\?([^"]+)"|<融 i="ybh\?([^"]+)"/g)) {
    const k = m[1] ?? m[2] ?? m[3]!;                              // 節聯 n=／嵌 i=ybh?／**融 i=ybh?（P4 目標也要逐條解析）**
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const rows: string[] = ['anchor\thits\tva\tline\theadcheck\tstatus'];
  let ok = 0, bad = 0;
  for (const [a, n] of counts) {
    const info = await nodeAnchorInfo(rd, a);
    if (!info) { bad++; rows.push(`${a}\t${n}\t\t\t\tFAIL:unresolved`); continue; }
    const line = mp.edgeLine(info.va);
    const raw = await mp.lineText(line);
    const kp = a.split('#')[1] ?? '';
    const good = raw.includes('n="' + kp + '"');
    if (good) ok++; else bad++;
    rows.push(`${a}\t${n}\t${info.va}\t${line}\t${raw.slice(0, 36).replace(/\s+/g, ' ')}\t${good ? 'OK' : 'FAIL:mismatch'}`);
  }
  // 驗收鉤子反轉：卷級 NS 現應解析且正中卷 1（d224efd 別名已上線）
  const neg = await nodeAnchorInfo(rd, 'T1579-1#kpD03-001');
  let negStatus = 'FAIL:別名未到';
  if (neg) {
    const raw = await mp.lineText(mp.edgeLine(neg.va));
    negStatus = raw.includes('<科03 n="kpD03-001"') ? 'ALIAS-ARRIVED' : 'FAIL:ALIAS-wrongline';
  }
  rows.push(`T1579-1#kpD03-001\t-\t${neg?.va ?? ''}\t\t\t${negStatus}`);
  // 語義回歸：篇級＝最後一筆、卷級＝該卷（d224efd 規格 §3）
  const pLast = await nodeAnchorInfo(rd, 'T1579#kpD01-001');
  const vFirst = await nodeAnchorInfo(rd, 'T1579-1#kpD01-001');
  rows.push(`語義回歸 T1579#kpD01-001=${pLast?.va} vs T1579-1#kpD01-001=${vFirst?.va}\t\t\t${pLast && vFirst && pLast.va !== vFirst.va && pLast.va > vFirst.va ? 'OK(last≠first)' : 'FAIL:semantics'}`);
  if ((pLast && vFirst && !(pLast.va !== vFirst.va && pLast.va > vFirst.va)) || negStatus !== 'ALIAS-ARRIVED') bad++;
  // 正控：篇 id 解析
  const pos = await nodeAnchorInfo(rd, 'PXJ-H#kpD03-001');
  rows.push(`PXJ-H#kpD03-001\t-\t${pos?.va ?? ''}\t${pos ? mp.edgeLine(pos.va) : ''}\t\t${pos ? 'OK:control' : 'FAIL:control'}`);
  fs.writeFileSync(path.join(OUTDIR, 'anchor-check.tsv'), rows.join('\n'), 'utf8');
  console.log(`anchor-check：${counts.size} 種錨點、${ok} OK、${bad} FAIL；負控 卷級NS=${negStatus}；正控 PXJ-H#=${pos ? 'OK' : 'FAIL'}；語義回歸見 tsv 末行`);
  // P1 跨庫驗證：ybh 發出的每個 taisho 頁欄聯必須在 taisho.adb 解析得到
  {
    const pages = new Map<string, number>();
    for (const m of lines.join('\n').matchAll(/<聯 i="taisho\?([^"]+)"/g)) pages.set(m[1]!, (pages.get(m[1]!) ?? 0) + 1);
    const trd = await AdbReader.open(new SyncIO('D:/accelon3/taisho.adb'));
    let tok = 0, tbad = 0;
    for (const p of pages.keys()) {
      const va = await anchorVa(trd, p);   // anchorVa 自會剝 #a-b 尾綴（probe-charpos 實證）
      if (va == null) { tbad++; if (tbad <= 5) console.log('  ⚠ taisho 頁欄解析失敗：' + p); } else tok++;
    }
    console.log(`P1 跨庫：taisho 頁欄 ${pages.size} 種、${taishoCnt} 條聯，解析 OK ${tok}、FAIL ${tbad}`);
    if (tbad > 0) console.log('⚠ 有跨庫 FAIL');
  }
  if (bad > 0) console.log('⚠ 有 FAIL，看 anchor-check.tsv');
}
