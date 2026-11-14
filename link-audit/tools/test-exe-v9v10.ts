/**
 * 回母區 §三的最後一問：V9（視圖內點科判＝節聯行為）與 V10（每輪 ≤50 段延遲取段）
 * 他們保留 GATE 並請我方「手動按一次、F12 抄 .fusionBlock[data-done="1"] 的數」。
 * 我方把這一步做成可重跑的量測（CDP 的 Runtime.evaluate 與 F12 控制台同一条碼路，
 * 不是另造標準），產出他們要的三個數：已填數、每輪增量上限、點科判後的捲動位移。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9445, WVDATA = 'D:/2026/_scratch-ybh/wv-v9v10-' + Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(WVDATA, { recursive: true });
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 160 && !url; i++) { await sleep(1500); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
if (!url) { console.log('FAIL：無 devtools'); process.exit(1); }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(7000);
await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/✕|×/.test(x.textContent)); b?.click(); return 1; })()`);
await sleep(2500);
// 找一個 <融> 多的卷：披尋記科判樹 → 點「乙一、略辨地名」這類有正文的節點
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(20000);
const nodeClick = await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); const hit=ls.find(e=>/乙一、略辨地名/.test(e.textContent)) ?? ls[1] ?? ls[0]; if(!hit) return '無'; hit.click(); return hit.textContent.trim().slice(0,18); })()`);
console.log('開的節點：', nodeClick);
await sleep(14000);
console.log('OFF 時殼：', await cdp.eval(`document.querySelectorAll('.fusionBlock').length`));
await cdp.eval(`(() => { const b=document.querySelector('#fusionOn'); b.checked=true; b.dispatchEvent(new Event('change')); return 1; })()`);

// ---- V10：逐輪取樣，看「已填」增量是否每輪 ≤50、且只填視野內的
let prev = 0; const series: number[] = [];
for (let i = 0; i < 14; i++) {
  await cdp.eval(`(() => { const b=[...document.querySelectorAll('.fusionBlock')].find(x=>x.dataset.done!=='1'); if(b) b.scrollIntoView({block:'center'}); return 1; })()`);
  await sleep(5000);
  const st = JSON.parse(JSON.stringify(await cdp.eval(`(() => { const bs=[...document.querySelectorAll('.fusionBlock')];
    const done=bs.filter(b=>b.dataset.done==='1'); const ybh=done.filter(b=>(b.dataset.i||'').startsWith('ybh?'));
    return { 殼:bs.length, 已填:done.length, ybh來源:ybh.length, 有內容:done.filter(b=>(b.textContent??'').replace(/\\s+/g,'').length>20).length }; })()`)));
  const delta = st.已填 - prev; prev = st.已填; series.push(delta);
  console.log(`輪 ${i + 1}：`, JSON.stringify(st), '增量', delta);
  if (st.已填 >= 6) break;
}
console.log('V10 每輪增量序列：', series.join(','), '· 最大增量', Math.max(...series), '· 最終已填', prev);

// ---- V9：點已填殼裡的科判標題（.nodeLink／.xrefLink／[data-n]），看捲動與游標
const v9 = JSON.parse(JSON.stringify(await cdp.eval(`(() => {
  const done=[...document.querySelectorAll('.fusionBlock')].filter(b=>b.dataset.done==='1');
  const host=document.querySelector('#docText');
  const scroller=[...document.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+300 && e.contains(host));
  const before={ top: scroller?scroller.scrollTop:-1, winY: window.scrollY,
                 游標: (document.querySelector('#dirTree .active, #dirTree [class*=active], #dirTree [aria-selected=\\"true\\"]')?.textContent ?? '').trim().slice(0,20) };
  const inner=done.map(b=>[...b.querySelectorAll('.nodeLink,.entryLink,.xrefLink,a,[data-n]')]).flat().filter(e=>e.textContent.trim().length>0);
  const target=inner[0] ?? null;
  if(!target) return { err:'殼內無可點連結', 殼內連結數: inner.length, 已填殼: done.length };
  const label=target.textContent.trim().slice(0,18);
  target.click();
  return { 點: label, 殼內連結數: inner.length, before };
})()`)));
console.log('V9 點擊：', JSON.stringify(v9));
await sleep(6000);
const after = await cdp.eval(`(() => { const host=document.querySelector('#docText');
  const scroller=[...document.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+300 && e.contains(host));
  return { top: scroller?scroller.scrollTop:-1, winY: window.scrollY,
           游標: (document.querySelector('#dirTree .active, #dirTree [class*=active], #dirTree [aria-selected=\\"true\\"]')?.textContent ?? '').trim().slice(0,20),
           高亮: document.querySelectorAll('mark.xrefHit, .jumpHit, [class*=highlight]').length }; })()`);
console.log('V9 點後：', JSON.stringify(after), '· 位移 top', (after as any).top - (v9.before?.top ?? -1));
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/v9v10-evidence.png', Buffer.from(shot.data, 'base64'));
console.log('截圖 → v9v10-evidence.png');
