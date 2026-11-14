/**
 * 一次跑完兩件事，供缺陷單用最新 exe 的證據：
 *  A) 反鏈索引：__revBar／__revPerf／__xrefPerf／__xrefLast 全數 dump
 *  B) 融視圖 ybh 格：勾開關 → 對第一顆 .fusionBlock 下 scrollIntoView → 斷言已填殼的 data-i 以 ybh? 開頭
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9441, WVDATA = 'D:/2026/_scratch-ybh/wv-final-' + Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(WVDATA, { recursive: true });
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 160 && !url; i++) { await sleep(1500); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
if (!url) { console.log('FAIL：無 devtools'); process.exit(1); }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/2026/_scratch-ybh/../ybh-check.txt').catch(() => {});
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await loadAdb(cdp, 'D:/accelon3/taisho.adb');
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(7000);
await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/✕|×/.test(x.textContent)); b?.click(); return 1; })()`);
await sleep(2500);
// ---- B) 融視圖（ybh 自己的 <融>）
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(20000);
await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); (ls.find(e=>/乙一、略辨地名|甲一、本地分/.test(e.textContent)) ?? ls[1] ?? ls[0])?.click(); return 1; })()`);
await sleep(14000);
await cdp.eval(`(() => { const b=document.querySelector('#fusionOn'); if(b){ b.checked=true; b.dispatchEvent(new Event('change')); } return 1; })()`);
await sleep(6000);
let f: any = null;
for (let i = 0; i < 10; i++) {
  await cdp.eval(`(() => { const b=document.querySelector('.fusionBlock'); if(b) b.scrollIntoView({block:'center'}); return 1; })()`);
  await sleep(6000);
  f = JSON.parse(JSON.stringify(await cdp.eval(`(() => { const bs=[...document.querySelectorAll('.fusionBlock')];
    const done=bs.filter(b=>b.dataset.done==='1'); const ybh=done.filter(b=>(b.dataset.i||'').startsWith('ybh?'));
    return { 殼:bs.length, 已填:done.length, ybh來源:ybh.length,
             首條:ybh[0]?{i:ybh[0].dataset.i,字:(ybh[0].textContent??'').replace(/\s+/g,'').length,起頭:(ybh[0].textContent??'').replace(/\s+/g,'').slice(0,30)}:null,
             狀態欄:(document.querySelector('#status')?.textContent??'').replace(/\s+/g,' ').trim().slice(0,40)}; })()`)));
  console.log(`融 第 ${i + 1} 次：`, JSON.stringify(f));
  if (f.ybh來源 > 0) break;
}
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/fusion-ybh-filled.png', Buffer.from(shot.data, 'base64'));
// ---- A) 反鏈索引
await cdp.eval(`(() => { const l=[...document.querySelectorAll('.xrefLink,.entryLink')].find(e=>/taisho/.test(e.getAttribute('data-xref')||'')); l?.click(); return 1; })()`);
await sleep(25000);
const dump = JSON.parse(JSON.stringify(await cdp.eval(`(() => ({ revBar: window.__revBar ?? null, revPerf: window.__revPerf ?? null, xrefPerf: window.__xrefPerf ?? null, xrefLast: window.__xrefLast ?? null }))()`)));
console.log('反鏈儀表：', JSON.stringify(dump));
console.log('反鏈條 DOM：', JSON.stringify(await cdp.eval(`(() => ({ 有:!!document.querySelector('.xrefRevBar'), 一排:document.querySelectorAll('.revChips > *').length, 顯示全部:document.querySelector('.revShowAll')?.textContent.trim().slice(0,22) ?? null, 抽屜:(document.querySelector('#revList, .revPanel')?.textContent ?? '').replace(/\s+/g,' ').trim().slice(0,34) }))()`)));
