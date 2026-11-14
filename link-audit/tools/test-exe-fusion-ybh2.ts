/**
 * 補上最後一格：**ybh.adb 自己的 `<融>` 在新 exe 內被填入**（前幾輪的證據都落在 session
 * 還原出來的別庫上）。這輪用已驗證的正確 recipe：先關啟動對話框 → active=ybh →
 * 樹頁籤選披尋記科判 → 點卷 → 開融視圖 → 捲動讓殼進視野 → 斷言已填殼的 data-i 以 `ybh?` 開頭。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9429, WVDATA = 'D:/2026/_scratch-ybh/wv-fybh-' + Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(WVDATA, { recursive: true });
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 200 && !url; i++) { await sleep(1500); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(7000);
await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/✕|×/.test(x.textContent)); b?.click(); return 1; })()`);
await sleep(2500);
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(18000);
await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); (ls.find(e=>/乙一、略辨地名|甲一、本地分/.test(e.textContent)) ?? ls[1] ?? ls[0])?.click(); return 1; })()`);
await sleep(14000);
console.log('正文 chars：', await cdp.eval(`(document.querySelector('#docText')?.textContent ?? '').length`));
console.log('開關隱顯：', await cdp.eval(`document.querySelector('#fusionWrap')?.hidden`), '· 源含 <融>：', await cdp.eval(`(document.querySelector('#docText')?.innerHTML ?? '').includes('融')`));
await cdp.eval(`(() => { const b=document.querySelector('#fusionOn'); b.checked=true; b.dispatchEvent(new Event('change')); return 1; })()`);
await sleep(6000);
const snap = `(() => { const bs=[...document.querySelectorAll('.fusionBlock')];
  const vis=b=>b.offsetParent!==null && b.getBoundingClientRect().bottom>0 && b.getBoundingClientRect().top<innerHeight;
  const done=bs.filter(b=>b.dataset.done==='1');
  const ybh=done.filter(b=>(b.dataset.i||'').startsWith('ybh?'));
  return { 殼:bs.length, 視野內:bs.filter(vis).length, 已填:done.length, 已填且來源為ybh:ybh.length,
           首條:ybh[0] ? { i:ybh[0].dataset.i, 字:(ybh[0].textContent??'').replace(/\\s+/g,'').length, 起頭:(ybh[0].textContent??'').replace(/\\s+/g,'').slice(0,34) } : null,
           狀態欄:(document.querySelector('#status')?.textContent ?? '').replace(/\\s+/g,' ').trim().slice(0,44) }; })()`;
let last: any = null;
for (let s = 0; s < 14; s++) {
  last = JSON.parse(JSON.stringify(await cdp.eval(snap)));
  console.log(`第 ${s + 1} 次：`, JSON.stringify(last));
  if (last.已填且來源為ybh > 0) break;
  await cdp.eval(`(() => { const b=document.querySelector('.fusionBlock'); if(b) b.scrollIntoView({block:'center'}); return 1; })()`);
  await sleep(5000);
}
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/fusion-ybh-filled.png', Buffer.from(shot.data, 'base64'));
console.log('截圖 → fusion-ybh-filled.png');
console.log(last && last.已填且來源為ybh > 0 ? 'PASS：ybh 自己的 <融> 在 exe 內被填入' : 'CHECK：尚未取得 ybh 來源的已填殼');
