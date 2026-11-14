/**
 * R7 上機實測（從 taisho 端直接落到 30p279a）。
 * 30p279a 的 adb 行＝2,419,899（probe-page-line.ts 實測；279b 標記在 2,419,926，故 279a 佔 27 行）。
 * 用法：app 的 #query 框吃「#行號」，跳完直接量反鏈條。
 *
 * 驗四項（母區 prompt-ybh-r7-shipped.md 的聲稱）：
 *   ① 一排 >40 顆時只渲染前 20（REV_INLINE_TOP），其餘不入 DOM
 *   ② 末尾有 .revShowAll「顯示全部 N 條」，且 .xrefRevBar 帶 data-revhost／data-revpage／data-revlistname
 *   ③ 抽屜起手 200 條／頁，.revMore 每次 +200
 *   ④ 切排序後 cap 仍在 20（resortRevBar 也走 revChipsHtml）
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9397, WVDATA = 'D:/2026/_scratch-ybh/wv-r7d-' + Date.now();
const LINE = +(process.argv[2] ?? 2419899);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(WVDATA, { recursive: true });
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 120 && !url; i++) { await sleep(1500); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
if (!url) { console.log('FAIL：無 devtools'); process.exit(1); }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await loadAdb(cdp, 'D:/accelon3/taisho.adb');
console.log('兩庫已開（ybh 提供反鏈來源，taisho 是被鏈目標）');

// 切到 taisho（大正）為 active db
console.log('切庫：', await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/大正/.test(e.textContent)); if(!c) return '無大正 chip'; c.click(); return c.textContent.replace(/\\s+/g,'').slice(0,10); })()`));
await sleep(8000);

// 用 #行號 跳到 30p279a
await cdp.eval(`(() => { const q=document.querySelector('#query'); q.value='#${LINE}'; q.dispatchEvent(new Event('input')); q.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',keyCode:13,bubbles:true})); return 1; })()`);
await sleep(12000);
console.log('跳轉後頁尾：', await cdp.eval(`(document.querySelector('#pager, .pager, [class*=page]')?.textContent ?? '').replace(/\\s+/g,' ').trim().slice(0,60)`));
console.log('正文起頭：', JSON.stringify(String(await cdp.eval(`(document.querySelector('#docText')?.textContent ?? '').replace(/\\s+/g,'').slice(0,50)`))));

const bar = `(() => {
  const b=document.querySelector('.xrefRevBar');
  const chips=[...document.querySelectorAll('.revChips > *')];
  const all=document.querySelector('.revShowAll');
  return { 有反鏈條: !!b, 一排顆數: chips.length,
    顯示全部: all ? all.textContent.replace(/\\s+/g,' ').trim().slice(0,26) : null,
    條文字: (b?.textContent ?? '').replace(/\\s+/g,' ').trim().slice(0,56),
    host: b?.getAttribute('data-revhost') ?? '', page: b?.getAttribute('data-revpage') ?? '', name: b?.getAttribute('data-revlistname') ?? '' };
})()`;
console.log('①② 一排：', JSON.stringify(await cdp.eval(bar)));

console.log('③ 按顯示全部：', await cdp.eval(`(() => { const s=document.querySelector('.revShowAll'); if(!s) return '無按鈕'; s.click(); return 'clicked'; })()`));
await sleep(10000);
const drawer = `(() => {
  const rows=[...document.querySelectorAll('.revRow, .revItem, [class*=revRow], .revList > *')].filter(e=>e.offsetParent!==null);
  const more=document.querySelector('.revMore');
  const head=(document.querySelector('.revListHead, .revDrawer, #revList, .revPanel')?.textContent ?? '').replace(/\\s+/g,' ').trim().slice(0,50);
  return { 抽屜可見列數: rows.length, 載入更多: more ? more.textContent.replace(/\\s+/g,' ').trim().slice(0,40) : null, 抽屜標題: head };
})()`;
console.log('③ 抽屜起手：', JSON.stringify(await cdp.eval(drawer)));
await cdp.eval(`(() => { const m=document.querySelector('.revMore'); if(m) m.click(); return 1; })()`);
await sleep(9000);
console.log('③ 再載入一頁：', JSON.stringify(await cdp.eval(drawer)));

const sorts = await cdp.eval(`(() => { const t=[...document.querySelectorAll('.revSort, [class*=sort] button, .revListHead button')].map(e=>e.textContent.trim().slice(0,8)); return t.join(' | '); })()`);
console.log('④ 排序按鈕：', sorts);
await cdp.eval(`(() => { const t=[...document.querySelectorAll('.revSort, [class*=sort] button, .revListHead button')].find(e=>/來源|目標|序/.test(e.textContent)); if(t) t.click(); return 1; })()`);
await sleep(8000);
console.log('④ 切排序後一排：', JSON.stringify(await cdp.eval(bar)));

const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/r7-279a.png', Buffer.from(shot.data, 'base64'));
console.log('截圖 → r7-279a.png');
