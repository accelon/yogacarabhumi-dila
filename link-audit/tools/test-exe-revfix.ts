/**
 * 反鏈修復上機實測（exe f800cf6f21f1 19:09 版，已含母區 19ccdb8 的 revPageKey）＋ R7 兩格補驗。
 * 真 ybh.adb（v25，sha 1627b025）＋ taisho.adb 同開，點帶 #a-b 的聯，量：
 *   ① __revBar.count 是否 >0（舊版恒 0）
 *   ② .xrefRevBar 是否出現、data-revhost／revpage／revlistname 是否齊
 *   ③ 一排是否 cap 在 20 顆＋「顯示全部 N 條」（R7 第一格）
 *   ④ 抽屜是否起手 200／頁、.revMore 是否 +200（R7 第二格）
 *   ⑤ 切排序後 cap 是否仍在 20
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
const { Cdp, loadAdb } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const PORT = 9453, WVDATA = 'D:/2026/_scratch-ybh/wv-revfix-' + Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(WVDATA, { recursive: true });
const kids: any[] = [];
process.on('exit', () => { for (const p of kids) { try { p.kill(); } catch { /* 已走 */ } } });
kids.push(spawn('D:/accelon3/accelon26.exe', [], { env: { ...process.env, ACCELON26_DEBUG_PORT: String(PORT), ACCELON26_WEBVIEW_DIR: WVDATA }, stdio: 'ignore' }));
let url = '';
for (let i = 0; i < 200 && !url; i++) { await sleep(1500); try { const j = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); url = (j as any[]).find((t: any) => t.type === 'page' && t.webSocketDebuggerUrl)?.webSocketDebuggerUrl ?? ''; } catch { /* 未起 */ } }
if (!url) { console.log('FAIL：無 devtools'); process.exit(1); }
const cdp = await Cdp.attach(url);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await loadAdb(cdp, 'D:/accelon3/taisho.adb');
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(8000);
// 啟動對話框必須「確認關掉」才能往下——上一版只點第一個 ✕，結果對話框還在，點擊全落空
for (let i = 0; i < 8; i++) {
  const gone = await cdp.eval(`(() => {
    const vis = [...document.querySelectorAll('*')].some(e => e.offsetParent !== null && (e.textContent ?? '').includes('開放古籍平台') && e.children.length < 12);
    if (!vis) return true;
    const dlg = [...document.querySelectorAll('button')].filter(b => b.offsetParent !== null && /✕|×/.test(b.textContent));
    const inBox = dlg.find(b => b.closest('.modal, dialog, [class*=modal], [class*=about], [class*=dialog]')) ?? dlg[dlg.length - 1];
    inBox?.click();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    return false;
  })()`);
  console.log(`  對話框關閉嘗試 ${i + 1}：${gone ? '已關' : '仍在'}`);
  if (gone) break;
  await sleep(2500);
}
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(20000);
await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); (ls.find(e=>/甲一、本地分/.test(e.textContent)) ?? ls[1] ?? ls[0])?.click(); return 1; })()`);
await sleep(14000);
// 大章是虛擬化渲染：落點附近的 聯 可能不在 DOM 裡，逐段捲 #docBody 把它拉進來
let clicked: string | null = null;
for (let i = 0; i < 14 && !clicked; i++) {
  clicked = String(await cdp.eval(`(() => { const l=[...document.querySelectorAll('.xrefLink,.entryLink')].find(e=>/taisho\\?30p279a#/.test(e.getAttribute('data-xref')||'')); if(!l) return ''; l.click(); return l.getAttribute('data-xref'); })()`));
  if (!clicked) {
    await cdp.eval(`(() => { const sc=document.querySelector('#docBody'); if(sc) sc.scrollTop += 2400; return 1; })()`);
    await sleep(4000);
  }
}
if (!clicked) clicked = '找不到帶窗聯（捲了 14 段仍無，可能是落點在別卷）';
console.log('① 點了聯：', clicked);
await sleep(25000);
console.log('② __revBar／儀表：', JSON.stringify(await cdp.eval(`(() => ({ revBar: window.__revBar ?? null, revPerf: window.__revPerf ?? null, xrefPerf: window.__xrefPerf ?? null }))()`)));
const bar = `(() => { const b=document.querySelector('.xrefRevBar');
  return { 有:!!b, 一排:document.querySelectorAll('.revChips > *').length,
    顯示全部:document.querySelector('.revShowAll')?.textContent.replace(/\\s+/g,' ').trim().slice(0,24) ?? null,
    revall:document.querySelector('.revShowAll')?.dataset.revall ?? '',
    host:b?.dataset.revhost ?? '', page:b?.dataset.revpage ?? '', name:b?.dataset.revlistname ?? '',
    條頭:(b?.textContent ?? '').replace(/\\s+/g,' ').trim().slice(0,46) }; })()`;
console.log('③ 一排：', JSON.stringify(await cdp.eval(bar)));
console.log('④ 按顯示全部：', await cdp.eval(`(() => { const s=document.querySelector('.revShowAll'); if(!s) return '無按鈕'; s.click(); return 'clicked revall=' + (s.dataset.revall ?? ''); })()`));
const drawer = `(() => { const rows=[...document.querySelectorAll('.revRow, .revItem, [class*=revRow], .revList > *')].filter(e=>e.offsetParent!==null);
  return { 可見列數: rows.length, 更多: document.querySelector('.revMore')?.textContent.replace(/\\s+/g,' ').trim().slice(0,40) ?? null }; })()`;
let d0: any = null;
for (let i = 0; i < 10; i++) { await sleep(9000); d0 = JSON.parse(JSON.stringify(await cdp.eval(drawer))); console.log(`④ 抽屜第 ${i + 1} 次：`, JSON.stringify(d0)); if (d0.可見列數 > 0) break; }
await cdp.eval(`(() => { document.querySelector('.revMore')?.click(); return 1; })()`);
await sleep(10000);
console.log('④ 載入更多後：', JSON.stringify(await cdp.eval(drawer)));
await cdp.eval(`(() => { const b=[...document.querySelectorAll('[data-revsort]')].find(x=>x.dataset.revsort==='host'); b?.click(); return 1; })()`);
await sleep(9000);
console.log('⑤ 切目標序後一排：', JSON.stringify(await cdp.eval(bar)));
const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/revfix-e2e.png', Buffer.from(shot.data, 'base64'));
console.log('截圖 → revfix-e2e.png');
