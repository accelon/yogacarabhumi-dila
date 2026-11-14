/**
 * A/B 判別：反鏈修復到底在不在效果裡。
 *   A = 現行 HTML（D:\accelon3\accelon26.html，19:04，含 revPageKey）── 無頭 Edge 直接跑
 *   B = 現行 exe（f800cf6f21f1，19:09）── 已量過：__revBar.count=0、__revPerf.n=2403（與修前同值）
 * 若 A 出 count>0 而 B 仍 0 ⇒ exe 內嵌的 UI 不是這份 HTML（`exe.includes(html)=false` 已有跡象），
 * 要再壓一次；若 A 也 0 ⇒ 修複未生效，另有第二因（索引只從已開源庫建、或建鍵處未全改到）。
 */
import fs from 'node:fs';
const { Cdp, loadAdb, launch } = await import('D:/2026/adb-converter/ts/tools/_cdp.ts');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const shot = process.argv[2] ?? 'D:/accelon3/accelon26.html';
const { cdp, close } = await launch({ html: shot, tag: 'revab', windowSize: '--window-size=1400,1000' });
console.log('無頭瀏覽器已起，載入', shot);
await loadAdb(cdp, 'D:/accelon3/ybh.adb');
await loadAdb(cdp, 'D:/accelon3/taisho.adb');
// 啟動對話框（HTML 版也可能有）：確認關掉
for (let i = 0; i < 6; i++) {
  const gone = await cdp.eval(`(() => {
    const vis=[...document.querySelectorAll('*')].some(e=>e.offsetParent!==null && (e.textContent??'').includes('開放古籍平台') && e.children.length<12);
    if(!vis) return true;
    const b=[...document.querySelectorAll('button')].filter(x=>x.offsetParent!==null && /✕|×/.test(x.textContent));
    (b[b.length-1])?.click(); return false; })()`);
  if (gone) break;
  await sleep(2000);
}
await cdp.eval(`(() => { const c=[...document.querySelectorAll('#dbTabs .dbChip')].find(e=>/瑜伽/.test(e.textContent)); c?.click(); return 1; })()`);
await sleep(9000);
await cdp.eval(`(() => { const s=document.querySelector('#dirPick'); const o=[...s.options].find(o=>/披尋記/.test(o.textContent)); if(o){s.value=o.value;s.dispatchEvent(new Event('change'));} return 1; })()`);
await sleep(20000);
await cdp.eval(`(() => { const ls=[...document.querySelectorAll('#dirTree *')].filter(e=>!e.children.length && e.textContent.trim().length>1); (ls.find(e=>/甲一、本地分/.test(e.textContent)) ?? ls[1] ?? ls[0])?.click(); return 1; })()`);
await sleep(14000);
let clicked = '';
for (let i = 0; i < 16 && !clicked; i++) {
  clicked = String(await cdp.eval(`(() => { const l=[...document.querySelectorAll('.xrefLink,.entryLink')].find(e=>/taisho\\?30p279a#/.test(e.getAttribute('data-xref')||'')); if(!l) return ''; l.click(); return l.getAttribute('data-xref'); })()`));
  if (!clicked) { await cdp.eval(`(() => { const sc=document.querySelector('#docBody'); if(sc) sc.scrollTop += 2400; return 1; })()`); await sleep(4000); }
}
console.log('① 點了聯：', clicked || '找不到帶窗聯');
await sleep(25000);
console.log('② 儀表：', JSON.stringify(await cdp.eval(`(() => ({ revBar: window.__revBar ?? null, revPerf: window.__revPerf ?? null, xrefPerf: window.__xrefPerf ?? null }))()`)));
console.log('③ 反鏈條：', JSON.stringify(await cdp.eval(`(() => { const b=document.querySelector('.xrefRevBar');
  return { 有:!!b, 一排:document.querySelectorAll('.revChips > *').length,
    顯示全部:document.querySelector('.revShowAll')?.textContent.replace(/\\s+/g,' ').trim().slice(0,24) ?? null,
    revall:document.querySelector('.revShowAll')?.dataset.revall ?? '',
    host:b?.dataset.revhost ?? '', page:b?.dataset.revpage ?? '', name:b?.dataset.revlistname ?? '' }; })()`)));
console.log('④ 按顯示全部：', await cdp.eval(`(() => { const s=document.querySelector('.revShowAll'); if(!s) return '無按鈕'; s.click(); return 'clicked revall=' + (s.dataset.revall ?? ''); })()`));
await sleep(12000);
console.log('④ 抽屜：', JSON.stringify(await cdp.eval(`(() => ({ 可見列數: [...document.querySelectorAll('.revRow, .revItem, [class*=revRow], .revList > *')].filter(e=>e.offsetParent!==null).length,
  更多: document.querySelector('.revMore')?.textContent.replace(/\\s+/g,' ').trim().slice(0,40) ?? null }))()`)));
const img = await cdp.send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync('D:/2026/_scratch-ybh/revab-html.png', Buffer.from(img.data, 'base64'));
console.log('截圖 → revab-html.png');
await close();
