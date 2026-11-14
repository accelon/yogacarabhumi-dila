/**
 * R7 上機實測（最終版）。關鍵修正在於：反鏈條 `.xrefRevBar` 是**右欄（文字欄）顯示跨庫頁面時**才出現
 * （xref.ts:1170 revBarHtml 註明「右欄的跨庫頁面用」），前幾輪我一直在主欄找，所以永遠是 0。
 * 另外母區把量好記在 `window.__revBar = {db,pageId,count,srcs}`——直接讀它就不用靠 DOM 猜。
 *
 * 步驟：開 ybh＋taisho → active=ybh → 在正文點一顆 `.xrefLink`（CBETA 聯）→ 右欄落到 taisho 某欄 →
 *   ① __revBar.count 是否 >40；② 一排是否只渲染 20 顆＋「顯示全部 N 條」；
 *   ③ 點顯示全部 → 抽屜起手 200／頁、.revMore 每次 +200；④ 切排序 cap 仍在 20。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9405, WVDATA = 'D:/2026/_scratch-ybh/wv-r7f-' + Date.now();
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
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(9000);
// 選披尋記科判樹並開一卷（v19 起科判行有 CBETA 聯）
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(16000);
await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); (ls.find(e=>/甲一、本地分/.test(e.textContent)) ?? ls[0])?.click(); return 1; })()`);
await sleep(14000);
console.log('正文 chars：', await cdp.eval(`(document.querySelector('#docText')?.textContent ?? '').length`),
  '· .xrefLink 數：', await cdp.eval(`document.querySelectorAll('.xrefLink, .entryLink').length`));

const linkInfo = await cdp.eval(`(() => {
  const l=[...document.querySelectorAll('.xrefLink, .entryLink')].find(e=>/taisho/.test(e.getAttribute('data-key')||e.getAttribute('data-i')||e.textContent));
  if(!l) return { err:'無 xrefLink' };
  l.click();
  return { text:l.textContent.trim().slice(0,10), attrs:Object.fromEntries([...l.attributes].map(a=>[a.name,String(a.value).slice(0,40)])) };
})()`);
console.log('點了聯：', JSON.stringify(linkInfo));
await sleep(16000);
console.log('① __revBar：', JSON.stringify(JSON.parse(JSON.stringify(await cdp.eval(`window.__revBar ?? null`)))));
const bar = `(() => {
  const b=document.querySelector('.xrefRevBar');
  return { 有:!!b, 一排顆數:document.querySelectorAll('.revChips > *, .xrefRevBar button').length,
    顯示全部:document.querySelector('.revShowAll')?.textContent.trim().slice(0,26) ?? null,
    host:b?.dataset.revhost ?? '', page:b?.dataset.revpage ?? '', name:b?.dataset.revlistname ?? '',
    條文字:(b?.textContent ?? '').replace(/\\s+/g,' ').trim().slice(0,54) };
})()`;
for (let i = 0; i < 8; i++) {
  const s = JSON.parse(JSON.stringify(await cdp.eval(bar)));
  console.log(`② 第 ${i + 1} 次：`, JSON.stringify(s));
  if (s.有 && s.一排顆數 > 0) break;
  await sleep(9000);
}
console.log('③ 按顯示全部：', await cdp.eval(`(() => { const s=document.querySelector('.revShowAll'); if(!s) return '無按鈕'; s.click(); return 'clicked N=' + (s.dataset.revall||''); })()`));
const drawer = `(() => {
  const rows=[...document.querySelectorAll('.revRow, .revItem, [class*=revRow], .revList > *')].filter(e=>e.offsetParent!==null);
  return { 可見列數: rows.length, 載入更多: document.querySelector('.revMore')?.textContent.replace(/\\s+/g,' ').trim().slice(0,40) ?? null,
           標題:(document.querySelector('.revListHead, #revList, .revPanel')?.textContent ?? '').replace(/\\s+/g,' ').trim().slice(0,44) };
})()`;
for (let i = 0; i < 8; i++) { await sleep(8000); const d = JSON.parse(JSON.stringify(await cdp.eval(drawer))); console.log(`③ 抽屜第 ${i + 1} 次：`, JSON.stringify(d)); if (d.可見列數 > 0) break; }
await cdp.eval(`(() => { document.querySelector('.revMore')?.click(); return 1; })()`);
await sleep(9000);
console.log('③ 載入更多後：', JSON.stringify(await cdp.eval(drawer)));
await cdp.eval(`(() => { const b=[...document.querySelectorAll('[data-revsort]')].find(x=>x.dataset.revsort==='host'); b?.click(); return 1; })()`);
await sleep(9000);
console.log('④ 切目標序後：', JSON.stringify(await cdp.eval(bar)));
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/r7-279a.png', Buffer.from(shot.data, 'base64'));
console.log('截圖 → r7-279a.png');
