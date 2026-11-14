/**
 * 決定性一測：**ybh.adb 自己的 <融>** 在新 exe 裡填不填得動（前一輪 已填=0 是因為那 4 個殼在視窗外，
 * V10 本来就只填可見的；本輪邊捲邊測，並用全新 WebView2 profile 避免上一輪殘留的其他庫分頁）。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9371;
const WVDATA = 'D:/2026/_scratch-ybh/webview-fusion-fresh';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
if (fs.existsSync(WVDATA)) fs.rmSync(WVDATA, { recursive: true, force: true });   // 全新 profile，避免上一輪殘留的其他庫分頁
fs.mkdirSync(WVDATA, { recursive: true });
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 150 && !url; i++) { await sleep(1000); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
console.log('active db：', await cdp.eval(`(document.querySelector('#dbHint')?.textContent ?? document.title ?? '').trim().slice(0,30)`));

// 選披尋記科判樹 → 等建好 → 點一個有正文的節點
for (let i = 0; i < 20; i++) {
  if (await cdp.eval(`[...document.querySelectorAll('#dirPick option')].some(o=>/披尋記/.test(o.textContent))`)) break;
  await sleep(3000);
}
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(!o) return 0; s.value=o.value; s.dispatchEvent(new Event('change')); return 1; })()`);
let leafCount = 0;
for (let i = 0; i < 40; i++) {
  await sleep(3000);
  leafCount = Number(await cdp.eval("Array.from(document.querySelectorAll('#dirTree *')).filter(e=>!e.children.length && e.textContent.trim().length>1).length"));
  const building = await cdp.eval("String(document.querySelector('#dirTree') && document.querySelector('#dirTree').textContent.indexOf('建立中') >= 0)");
  if (building !== 'true' && leafCount > 5) break;
}
console.log('樹葉數：', leafCount);
const clicked = await cdp.eval(`(() => {
  const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1);
  const hit=ls.find(e=>/甲一、本地分|卷第1|冊1/.test(e.textContent.trim())) ?? ls[0];
  if(!hit) return '無'; hit.click(); return hit.textContent.trim().slice(0,20);
})()`);
console.log('點了：', clicked);
await sleep(14000);
console.log('正文 chars：', await cdp.eval(`(document.querySelector('#docText')?.textContent ?? '').length`));
await cdp.eval(`(() => { const b=document.querySelector('#fusionOn'); b.checked=true; b.dispatchEvent(new Event('change')); return 1; })()`);
await sleep(5000);
const snap = `(() => { const bs=[...document.querySelectorAll('.fusionBlock')];
  const vis=b=>b.offsetParent!==null && b.getBoundingClientRect().bottom>0 && b.getBoundingClientRect().top<innerHeight;
  const f=bs.filter(b=>b.dataset.done==='1');
  return { 殼:bs.length, 可見:bs.filter(vis).length, 已填:bs.filter(b=>b.dataset.done==='1').length,
           有內容:bs.filter(b=>(b.textContent??'').replace(/\\s+/g,'').length>30).length,
           首個已填來源:f[0]?.dataset.i ?? '', 首個已填文字:f[0]?(f[0].textContent??'').replace(/\\s+/g,'').slice(0,44):'',
           狀態欄:(document.querySelector('#status')?.textContent??'').replace(/\\s+/g,' ').trim().slice(0,50) }; })()`;
console.log('開關後未捲：', JSON.stringify(await cdp.eval(snap)));
let done = 0;
for (let s = 1; s <= 12 && !done; s++) {
  await cdp.eval(`(() => { const c=[...document.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+200 && e.querySelector('#docText')); if(c) c.scrollTop += 900; window.scrollBy(0,900); return 1; })()`);
  await sleep(3500);
  const st = JSON.parse(JSON.stringify(await cdp.eval(snap))) as any;
  console.log(`捲 ${s}：`, JSON.stringify(st));
  done = st.已填;
}
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/fusion-ybh-on.png', Buffer.from(shot.data, 'base64'));
console.log('截圖 → fusion-ybh-on.png');
// 判據必須驗「來源錨屬於 ybh」——只數已填個數會被別的庫（例如 session 還原出 fuyan 的 ys.adb）蒙混過去
const src = await cdp.eval(`(() => { const b=[...document.querySelectorAll('.fusionBlock')].find(x=>x.dataset.done==='1' && (x.textContent??'').replace(/\\s+/g,'').length>30); return b ? (b.dataset.i||'') : ''; })()`);
console.log('已填殼的來源錨：', src);
console.log(String(src).startsWith('ybh?') && done > 0 ? 'PASS：ybh.adb 的 <融> 在新 exe 內確實被填入' : 'CHECK：未取得 ybh 來源的已填殼（很可能是 active db 不是 ybh，或被動到的還是別的庫）');
