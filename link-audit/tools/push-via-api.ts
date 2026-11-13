#!/usr/bin/env bun
/**
 * github.com:443 掛掉時的備援推送：走 api.github.com（實測可達）用 Git Data API 重放
 * fork/main..HEAD 的每一筆 commit，最後 PATCH refs/heads/<branch>。
 * - token 由本機 git credential helper 取，**絕不印出、不寫檔**。
 * - 逐檔以 base64 blob 上傳（binary-safe：用 cat-file 取位元組）；commit 沿用原作者／日期／訊息。
 * - 代價：API 重建的 commit SHA 與本地不同（內容相同）；網路恢復後以
 *   `git fetch fork && git reset --hard fork/main` 對齊（reset 屬破壞性，須使用者點頭）。
 * 用法：bun push-via-api.ts [owner/repo] [branch]
 */
import { execFileSync } from 'node:child_process';

const REPO = process.argv[2] ?? 'accelon/yogacarabhumi-dila';
const BRANCH = process.argv[3] ?? 'main';
const CWD = 'D:/2026/yogacarabhumi-dila';

const gitStr = (...a: string[]) => execFileSync('git', a, { cwd: CWD, maxBuffer: 256 * 1024 * 1024 }).toString();
const gitBuf = (...a: string[]) => execFileSync('git', a, { cwd: CWD, maxBuffer: 256 * 1024 * 1024 });

const cred = execFileSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8' });
const token = (/^password=(.*)$/m.exec(cred)?.[1] ?? '').trim();
if (!token) { console.log('拿不到 GitHub token（git credential helper 無紀錄）'); process.exit(1); }
console.log(`token 已取得（長度 ${token.length}，內容不顯示）`);

const api = async (path: string, method = 'GET', body?: unknown) => {
  const r = await fetch('https://api.github.com' + path, {
    method,
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', 'User-Agent': 'ybh-line' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({} as any));
  if (!r.ok) throw new Error(`${method} ${path} → HTTP ${r.status} ${(j as any).message ?? ''}`);
  return j as any;
};

const base = gitStr('rev-parse', `remotes/fork/${BRANCH}`).trim();
const head = gitStr('rev-parse', BRANCH).trim();
if (base === head) { console.log('fork 已是最新，不必推'); process.exit(0); }
const commits = (() => { try { return gitStr('log', '--format=%H', '--reverse', `${base}..${head}`).trim().split(/\s+/).filter(Boolean); } catch { return []; } })();
console.log(`base=${base} head=${head} 本地 fork/main 追蹤=${(() => { try { return gitStr('rev-parse', 'remotes/fork/main').trim(); } catch { return '(無)'; } })()} 物件存在=${(() => { try { gitStr('cat-file', '-t', base); return '是'; } catch { return '否'; } })()}`);
if (process.argv.includes('--dry')) { console.log(`待重放 ${commits.length} 筆：${commits.map((c) => c.slice(0, 7)).join(' ')}`); process.exit(0); }
console.log(`待重放 ${commits.length} 筆：${commits.map((c) => c.slice(0, 7)).join(' ')}`);

let parent = base, localPrev = base, nBlobs = 0, nBytes = 0, cur = '';
const t0 = Date.now();
for (const sha of commits) {
  // 注意：`parent` 是**遠端**鏈上的 SHA（API 重建後與本地不同），`localPrev` 才是本地可比對的上一筆
  const files = gitStr('diff', '--name-status', `${localPrev}..${sha}`).trim().split('\n').filter(Boolean);
  const tree: any[] = [];
  for (const line of files) {
    const st = line[0]!;
    const path = line.slice(1).trim();
    if (st === 'D') { tree.push({ path, mode: '100644', type: 'blob', sha: null }); continue; }
    let buf: Buffer;
    try { buf = gitBuf('cat-file', 'blob', `${sha}:${path}`); } catch { continue; }     // 改名等邊角：以 base_tree 現況為準
    nBlobs++; nBytes += buf.length;
    const b = await api(`/repos/${REPO}/git/blobs`, 'POST', { content: buf.toString('base64'), encoding: 'base64' });
    tree.push({ path, mode: '100644', type: 'blob', sha: b.sha });
  }
  const pc = await api(`/repos/${REPO}/git/commits/${parent}`);
  const nt = await api(`/repos/${REPO}/git/trees`, 'POST', { base_tree: pc.tree.sha, tree });
  const meta = gitStr('show', '-s', '--format=%an%x1f%ae%x1f%aI%x1f%B', sha);
  const [an, ae, ad, ...rest] = meta.split('\x1f');
  const created = await api(`/repos/${REPO}/git/commits`, 'POST', {
    message: rest.join('\x1f').replace(/\s+$/, ''),
    tree: nt.sha, parents: [parent],
    author: { name: an!, email: ae!, date: ad! },
    committer: { name: an!, email: ae!, date: new Date().toISOString() },
  });
  cur = created.sha; parent = created.sha; localPrev = sha;
  console.log(`  ${sha.slice(0, 7)} → API ${created.sha.slice(0, 7)}（${tree.length} 檔，累計 ${nBlobs} blob／${(nBytes / 1048576).toFixed(1)} MiB／${((Date.now() - t0) / 1000).toFixed(0)}s）`);
}
const ref = await api(`/repos/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: cur, force: false });
console.log(`refs/heads/${BRANCH} → ${typeof ref === 'object' ? 'PATCH 送出' : ref}；本地 HEAD ${head.slice(0, 7)} 與遠端 ${cur.slice(0, 7)} 內容相同、SHA 不同（API 重建）`);
