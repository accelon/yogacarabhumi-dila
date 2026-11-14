/**
 * 對照實驗：同一頁欄，用「帶 #a-b 的聯」與「不帶 #a-b 的裸頁欄聯」各開一次右欄，
 * 讀 window.__revBar.count 比較。若裸頁欄有反鏈、帶 #a-b 是 0，
 * 則 R7 那格驗不成的原因不在 UI，而在**反鏈索引的鍵未剝 #a-b 後綴**。
 */
import { spawn } from 'node:child_process';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9413, WVDATA = 'D:/2026/_scratch-ybh/wv-r7h-' + Date.now();
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
await sleep(15000);
const list = await cdp.eval(`(() => {
  const all=[...document.querySelectorAll('.xrefLink,.entryLink')].map(e=>e.getAttribute('data-xref')||e.dataset.xref||'').filter(Boolean);
  return { 總數: all.length, 帶窗: all.filter(x=>x.includes('#')).length, 裸頁欄: all.filter(x=>!x.includes('#')).length, 例子帶窗: all.find(x=>x.includes('#')), 例子裸: all.find(x=>!x.includes('#')) };
})()`);
console.log('聯清單統計：', JSON.stringify(list));

async function tryOpen(target: string | undefined, label: string) {
  if (!target) { console.log(`${label}：無此類聯可點`); return; }
  const r = await cdp.eval(`(() => { const l=[...document.querySelectorAll('.xrefLink,.entryLink')].find(e=>(e.getAttribute('data-xref')||'')===${JSON.stringify(target)}); if(!l) return '找不到元素'; l.click(); return 'clicked'; })()`);
  console.log(`${label} 點「${target}」→ ${r}`);
  await sleep(18000);
  const st = await cdp.eval(`window.__revBar ? { db:window.__revBar.db, page:window.__revBar.pageId, count:window.__revBar.count, srcs:window.__revBar.srcs } : null`);
  console.log(`${label} __revBar：`, JSON.stringify(st));
  const bar = await cdp.eval(`(() => ({ 有:!!document.querySelector('.xrefRevBar'), 一排顆數:document.querySelectorAll('.revChips > *').length, 顯示全部:document.querySelector('.revShowAll')?.textContent.trim().slice(0,24) ?? null }))()`);
  console.log(`${label} 反鏈條：`, JSON.stringify(bar));
}
await tryOpen(String(list['例子帶窗'] ?? ''), '帶窗聯');
await tryOpen(String(list['例子裸'] ?? ''), '裸頁欄聯');
// 再用 taisho 當主庫直接開 30p279a（右欄之外的情境），看反鏈條是否出現
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/大正/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(6000);
await cdp.eval(`(() => { const q=document.querySelector('#query'); q.value='云何瑜伽師地'; q.dispatchEvent(new Event('input')); q.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',keyCode:13,bubbles:true})); return 1; })()`);
await sleep(14000);
await cdp.eval(`(() => { const h=[...document.querySelectorAll('.hit,.result,[class*=hit]')][0]; h?.click(); return 1; })()`);
await sleep(16000);
console.log('taisho 主欄 __revBar：', JSON.stringify(await cdp.eval(`window.__revBar ?? null`)));
