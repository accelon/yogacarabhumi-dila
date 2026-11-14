/**
 * 讀母區留在 window 上的反鏈儀表（__revPerf／__xrefPerf／__xrefLast），
 * 用它分辨「count=0」到底是索引沒建、還是鍵對不上。
 */
import { spawn } from 'node:child_process';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9421, WVDATA = 'D:/2026/_scratch-ybh/wv-r7j-' + Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 120 && !url; i++) { await sleep(1500); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await loadAdb(cdp, 'D:/accelon3/taisho.adb');
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(7000);
await cdp.eval(`(() => { const b=[...document.querySelectorAll('button')].find(x=>/✕|×/.test(x.textContent)); b?.click(); return 1; })()`);
await sleep(2000);
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(18000);
await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); (ls.find(e=>/甲一、本地分/.test(e.textContent)) ?? ls[0])?.click(); return 1; })()`);
await sleep(14000);
await cdp.eval(`(() => { const l=[...document.querySelectorAll('.xrefLink,.entryLink')].find(e=>/30p279a/.test(e.getAttribute('data-xref')||'')); l?.click(); return 1; })()`);
await sleep(25000);
const dump = await cdp.eval(`(() => {
  const j=(v)=>{ try { return JSON.parse(JSON.stringify(v)); } catch { return String(v); } };
  return { revBar: j(window.__revBar ?? null), revPerf: j(window.__revPerf ?? null),
           xrefPerf: j(window.__xrefPerf ?? null), xrefLast: j(window.__xrefLast ?? null) };
})()`);
console.log(JSON.stringify(dump, null, 1).slice(0, 1400));
