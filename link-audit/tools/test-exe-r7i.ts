/**
 * 最後一問：`__revBar.count = 0` 是「索引還沒建好」還是「鍵正規化不對」？
 * 做法：開聯 → 每 15 秒重讀一次 __revBar，並**重新按一次「清單」按鈕**（反鏈查表發生在點的那個瞬間，
 * 若索引是慢慢建起來的，第二次按就該看到 >0）。另外把 app 自報的反鏈相關全域狀態一并印出。
 */
import { spawn } from 'node:child_process';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9417, WVDATA = 'D:/2026/_scratch-ybh/wv-r7i-' + Date.now();
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
console.log('已點 30p279a 聯');
for (let i = 0; i < 8; i++) {
  await sleep(15000);
  const st = await cdp.eval(`(() => {
    const b=window.__revBar;
    return { 次:${i + 1}, revBar: b ? { page:b.pageId, count:b.count, srcs:(b.srcs||[]).length } : null,
      反鏈條: !!document.querySelector('.xrefRevBar'), 一排: document.querySelectorAll('.revChips > *').length,
      顯示全部: document.querySelector('.revShowAll')?.textContent.trim().slice(0,22) ?? null,
      抽屜文字: (document.querySelector('#revList, .revPanel, .revListHead')?.textContent ?? '').replace(/\\s+/g,' ').trim().slice(0,40) };
  })()`);
  console.log(JSON.stringify(st));
  if (st.反鏈條 || (st.revBar && st.revBar.count > 0)) break;
  // 重按「清單」入口，觸發另一次查表
  await cdp.eval(`(() => { const t=[...document.querySelectorAll('button')].find(b=>/清單|反鏈/.test(b.textContent) && !b.closest('.xrefRevBar')); t?.click(); return 1; })()`);
}
console.log('全域反鏈相關鍵：', await cdp.eval(`Object.keys(window).filter(k=>/rev|xref/i.test(k)).join(' ')`));
