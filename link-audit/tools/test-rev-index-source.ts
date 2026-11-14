/**
 * 補一個對照實驗（把「n=2403 從哪來」問清楚）：
 *   場 A：ybh＋taisho＋（session 還原的）反鍵版 三庫同開 → 量 __revPerf.n
 *   場 B：把反鍵版分頁關掉，只剩 ybh＋taisho → 再量一次 n
 * 若 B 的 n 掉到 0，則 2,403 條根本不是 ybh 的聯（而是那顆測試庫），
 * 「索引沒收到 ybh 的 49,749 條」就是唯一剩下的解釋。
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9461, WVDATA = 'D:/2026/_scratch-ybh/wv-revsrc-' + Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(WVDATA, { recursive: true });
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 200 && !url; i++) { await sleep(1500); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await loadAdb(cdp, 'D:/accelon3/taisho.adb');
for (let i = 0; i < 8; i++) {
  const gone = await cdp.eval(`(() => { const vis=[...document.querySelectorAll('*')].some(e=>e.offsetParent!==null && (e.textContent??'').includes('開放古籍平台') && e.children.length<12);
    if(!vis) return true; const b=[...document.querySelectorAll('button')].filter(x=>x.offsetParent!==null && /✕|×/.test(x.textContent)); (b[b.length-1])?.click(); return false; })()`);
  if (gone) break;
  await sleep(2000);
}
console.log('分頁清單：', await cdp.eval(`[...document.querySelectorAll('#dbTabs .dbChip')].map(e=>e.textContent.replace(/\\s+/g,'')).join(' | ')`));
// 先點一顆聯把反鏈索引跑起來，量場 A
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(8000);
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(20000);
await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); (ls.find(e=>/甲一、本地分/.test(e.textContent)) ?? ls[1] ?? ls[0])?.click(); return 1; })()`);
await sleep(12000);
let clicked = '';
for (let i = 0; i < 14 && !clicked; i++) {
  clicked = String(await cdp.eval(`(() => { const l=[...document.querySelectorAll('.xrefLink,.entryLink')].find(e=>/taisho\\?30p279a#/.test(e.getAttribute('data-xref')||'')); if(!l) return ''; l.click(); return l.getAttribute('data-xref'); })()`));
  if (!clicked) { await cdp.eval(`(() => { const sc=document.querySelector('#docBody'); if(sc) sc.scrollTop += 2400; return 1; })()`); await sleep(4000); }
}
await sleep(20000);
console.log('場 A（三庫同開）：', JSON.stringify(await cdp.eval(`(() => ({ 點了: ${JSON.stringify(clicked)}, revBar: window.__revBar ?? null, revPerf: window.__revPerf ?? null }))()`)));
// 關掉反鍵版（或任何非 ybh／taisho 的分頁）
const closed = await cdp.eval(`(() => { const cs=[...document.querySelectorAll('#dbTabs .dbChip')].filter(e=>!/瑜伽|大正/.test(e.textContent));
  const names=cs.map(e=>e.textContent.replace(/\\s+/g,'')); cs.forEach(c=>{ const x=[...c.querySelectorAll('*')].find(e=>/✕|×/.test(e.textContent)) ?? c.querySelector('button'); x?.click(); }); return names; })()`);
console.log('關掉的分頁：', JSON.stringify(closed));
await sleep(9000);
// 重新點聯，量場 B
let clicked2 = '';
for (let i = 0; i < 10 && !clicked2; i++) {
  clicked2 = String(await cdp.eval(`(() => { const l=[...document.querySelectorAll('.xrefLink,.entryLink')].find(e=>/taisho\\?30p279a#/.test(e.getAttribute('data-xref')||'')); if(!l) return ''; l.click(); return l.getAttribute('data-xref'); })()`));
  if (!clicked2) { await cdp.eval(`(() => { const sc=document.querySelector('#docBody'); if(sc) sc.scrollTop += 2400; return 1; })()`); await sleep(4000); }
}
await sleep(20000);
console.log('場 B（只剩 ybh＋taisho）：', JSON.stringify(await cdp.eval(`(() => ({ 點了: ${JSON.stringify(clicked2)}, revBar: window.__revBar ?? null, revPerf: window.__revPerf ?? null }))()`)));
console.log('剩餘分頁：', await cdp.eval(`[...document.querySelectorAll('#dbTabs .dbChip')].map(e=>e.textContent.replace(/\\s+/g,'')).join(' | ')`));
