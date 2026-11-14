/**
 * V9 補測：上一輪我用「找可滾容器」量捲動，回 top=-1（找不到容器）→ 那格不能算驗過。
 * 這輪改用與滾動容器無關的量法：點殼內科判前後，比 #docText 的 getBoundingClientRect().top
 * （只要畫面滾動，它相對視窗的位置就會變），並記下高亮元素數與 app 自報的最後一筆。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9449, WVDATA = 'D:/2026/_scratch-ybh/wv-v9b-' + Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(WVDATA, { recursive: true });
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 160 && !url; i++) { await sleep(1500); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(7000);
await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/✕|×/.test(x.textContent)); b?.click(); return 1; })()`);
await sleep(2500);
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(20000);
await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); (ls.find(e=>/甲一、本地分/.test(e.textContent)) ?? ls[1] ?? ls[0])?.click(); return 1; })()`);
await sleep(14000);
await cdp.eval(`(() => { const b=document.querySelector('#fusionOn'); b.checked=true; b.dispatchEvent(new Event('change')); return 1; })()`);
await sleep(12000);
await cdp.eval(`(() => { const b=[...document.querySelectorAll('.fusionBlock')].find(x=>x.dataset.done==='1'); if(b) b.scrollIntoView({block:'center'}); return 1; })()`);
await sleep(6000);
const probe = `(() => { const dt=document.querySelector('#docText');
  return { docTop: dt? Math.round(dt.getBoundingClientRect().top) : null,
           docTextTop: dt? Math.round((dt.textContent??'').length) : 0,
           已填: document.querySelectorAll('.fusionBlock[data-done=\\"1\\"]').length,
           高亮: document.querySelectorAll('mark.xrefHit, .xrefHit, [class*=jump], [class*=flash]').length,
           游標: [...document.querySelectorAll('#dirTree [class]')].filter(e=>/active|current|selected/i.test(e.className)).map(e=>e.textContent.trim().slice(0,14))[0] ?? '',
           可滾容器: [...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+200).map(e=>e.id||e.className).slice(0,4) }; })()`;
const before = JSON.parse(JSON.stringify(await cdp.eval(probe)));
console.log('點前：', JSON.stringify(before));
const clickInfo = JSON.parse(JSON.stringify(await cdp.eval(`(() => {
  const done=[...document.querySelectorAll('.fusionBlock[data-done="1"]')];
  const links=done.flatMap(b=>[...b.querySelectorAll('.nodeLink,.entryLink,.xrefLink')]);
  const t=links[0]; if(!t) return { err:'殼內無連結', 殼:done.length };
  const info={ 文字:t.textContent.trim().slice(0,18), class:t.className, attrs:[...t.attributes].map(a=>a.name+'='+String(a.value).slice(0,26)).join(' ') };
  t.click(); return info; })()`)));
console.log('點了殼內連結：', JSON.stringify(clickInfo));
await sleep(7000);
const after = JSON.parse(JSON.stringify(await cdp.eval(probe)));
console.log('點後：', JSON.stringify(after));
console.log('docTop 位移：', (after.docTop ?? 0) - (before.docTop ?? 0), '· 高亮差：', after.高亮 - before.高亮, '· 游標：', JSON.stringify(before.游標), '→', JSON.stringify(after.游標));
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/v9-evidence.png', Buffer.from(shot.data, 'base64'));
console.log('截圖 → v9-evidence.png');
