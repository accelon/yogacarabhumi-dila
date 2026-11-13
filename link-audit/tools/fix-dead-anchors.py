#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
fix-dead-anchors.py — ybh 死錨自動修復器（stdlib only）

原則（與 SUMMARY §16.10 裁決一致）：只修有確定性證據者，寧缺勿錯。
  F1 畸形定義錨點：標題行尾 `^kp…` 形如 kpT581D05-004（混入雜字）→ 正規化為 kpD05-004。
     修復後該科判即有定義，所有指向它的死鏈自動癒合。
  F2 標題唯一吻合重映射：引用指向全著作未定義的 kpD{tier}-{seq}，若目標卷同層
     恰有一條**標題文字唯一吻合**（正規化後）的現存科判 → 把引用改指該序號。
     多候選或零候選一律不動。
  F3 哨兵（seq ≥ 995）：披尋記「未攝入」標記 → 不動，僅報告。
  F4 越界／目標卷無此層：DILA 科判未完成 → 不動，僅報告。

用法：
  python fix-dead-anchors.py                # dry-run（默認），只出報告
  python fix-dead-anchors.py --apply        # 實際改檔（每檔留 .bak，git 倉內可免）
  python fix-dead-anchors.py --root D:\\2026\\yogacarabhumi-dila --report out.csv
"""
import argparse
import csv
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

DEF_RE = re.compile(r'^(#{1,6}\s+.*?\s*)\^(kp[A-Za-z0-9_-]+)(\s*)$', re.M)
CANON_RE = re.compile(r'^kpD(\d+)-(\d+)$')
CITE_RE = re.compile(r'\[\[([^\]|#]+)#\^(kpD(\d+)-(\d+))([^\]|]*)(\|[^\]]*)?\]\]')
WORKS = ['T1579', 'PXJ-H', 'T1580', 'T1828', 'T1829', 'T2801', 'T2802', 'T2259',
         'T1581', 'T1582', 'T1583', 'T1584', 'T1602', 'T1604', 'T1605', 'T1606', 'X0794']
CN = set(WORKS)
SERIES_RE = re.compile(r'^(.*)-(?:\d+|k|a)$')


def series_of(base: str) -> str:
    m = SERIES_RE.match(base)
    return m.group(1) if m else base


def norm_title(s: str) -> str:
    s = re.sub(r'^#+\s*', '', s.strip())                       # 去 markdown 井號
    s = re.sub(r'\^kp[#A-Za-z0-9_-]+', '', s)                  # 去錨點殘跡
    s = re.sub(r'^[A-Z]\d*\s*', '', s)                         # 去字母層級前綴（O13 之類）
    s = re.sub(r'^[甲乙丙丁戊己庚辛壬癸子丑寅卯辰巳午未申酉戌亥][一二三四五六七八九十]{1,3}、', '', s)
    return re.sub(r'[0-9０-９\s　、，。：；（）()·]', '', s)[:16]


def read(p: Path) -> str:
    return p.read_text(encoding='utf-8-sig')


def main() -> int:
    ap = argparse.ArgumentParser(description='ybh 死錨自動修復器（只修有證據者）')
    ap.add_argument('--root', default=r'D:/2026/yogacarabhumi-dila', help='vault 目錄')
    ap.add_argument('--apply', action='store_true', help='實際寫檔（默認 dry-run）')
    ap.add_argument('--report', default='', help='報告 CSV 輸出路徑')
    args = ap.parse_args()
    root = Path(args.root)
    files = sorted(root.glob('*.md'))

    # ---- 1) 定義集 + F1 畸形定義掃描 ----
    work_defs = {}          # ser -> set(kp)
    vol_tier_titles = {}    # (base, tier) -> [(seq, norm_title)]
    malformed = []          # (file, raw_token, canon)
    for f in files:
        base = f.stem
        ser = series_of(base)
        if ser not in CN:
            continue
        text = read(f)
        for m in DEF_RE.finditer(text):
            tok = m.group(2)
            cm = CANON_RE.match(tok)
            if cm:
                work_defs.setdefault(ser, set()).add(tok)
                vol_tier_titles.setdefault((base, int(cm.group(1))), []).append(
                    (int(cm.group(2)), norm_title(m.group(1))))
            else:
                fm = re.search(r'D(\d+)-(\d+)$', tok)   # kpT581D05-004 → 05-004
                if fm:
                    canon = f'kpD{fm.group(1)}-{fm.group(2)}'
                    if canon not in work_defs.get(ser, set()):
                        malformed.append((f, tok, canon))
                        work_defs.setdefault(ser, set()).add(canon)

    # ---- 2) 死錨引用 + F2 標題吻合 ----
    actions = []            # (file, kind, from, to, evidence)
    stats = {'F1': 0, 'F2': 0, 'F3': 0, 'F4': 0}
    cite_pat_by_file = {}
    for f in files:
        base = f.stem
        if series_of(base) not in CN:
            continue
        text = read(f)
        cur_title = ''
        edits = []
        for lm in re.finditer(r'^(#{1,6})\s+(.*)$', text, re.M):
            pass  # 標題歸屬：以引用出現位置前最近標題為準
        for m in CITE_RE.finditer(text):
            tgt = m.group(1).strip()
            tier, seq = int(m.group(3)), int(m.group(4))
            kp = m.group(2)
            if series_of(tgt) not in CN:
                continue
            if kp in work_defs.get(series_of(tgt), set()):
                continue
            # 所屬來源標題（引用前最近的一個標題行）
            head = None
            for hm in DEF_RE.finditer(text):
                if hm.start() >= m.start():
                    break
                head = hm
            src_title = norm_title(head.group(1)) if head else ''
            if seq >= 995:
                stats['F3'] += 1
                actions.append((f.name, 'F3-哨兵不動', kp, '', f'src「{src_title}」'))
                continue
            cands = [c for c in vol_tier_titles.get((tgt, tier), [])
                     if c[0] < 995                                   # 哨兵不作重映射目標
                     and len(c[1]) >= 2 and len(src_title) >= 2
                     and (c[1] == src_title or c[1].startswith(src_title) or src_title.startswith(c[1]))]
            if len(cands) == 1:
                new_kp = f'kpD{tier:02d}-{cands[0][0]:03d}'
                stats['F2'] += 1
                edits.append((m.start(), m.end(), kp, new_kp))
                actions.append((f.name, 'F2-標題重映射', kp, new_kp, f'「{src_title}」'))
            else:
                stats['F4'] += 1
                mx = max((c[0] for c in vol_tier_titles.get((tgt, tier), [])), default=None)
                actions.append((f.name, 'F4-未編不動', kp, '',
                                f'該層實編至 {mx}' if mx is not None else '目標卷無此層'))
        # 套用 F2 編輯（從後往前，避免位移）
        if edits and args.apply:
            chars = list(text)
            for s0, e0, old, new in reversed(edits):
                seg = text[s0:e0].replace(old, new)
                text = text[:s0] + seg + text[e0:]
            if not (root / '.git').exists():
                (f.with_suffix(f.suffix + '.bak')).write_text(read(f), encoding='utf-8')
            f.write_text(text, encoding='utf-8')

    # ---- 3) F1 落筆 ----
    if args.apply:
        for f, tok, canon in malformed:
            text = read(f)
            new = text.replace('^' + tok, '^' + canon)
            if new != text:
                if not (root / '.git').exists():
                    (f.with_suffix(f.suffix + '.bak')).write_text(text, encoding='utf-8')
                f.write_text(new, encoding='utf-8')
    stats['F1'] = len(malformed)

    print(f'模式：{"APPLY" if args.apply else "DRY-RUN"}｜F1 畸形定義 {stats["F1"]}｜'
          f'F2 標題重映射 {stats["F2"]}｜F3 哨兵(不動) {stats["F3"]}｜F4 未編(不動) {stats["F4"]}')
    for f, tok, canon in malformed:
        print(f'  F1 {f.name}: ^{tok} → ^{canon}')
    if args.report:
        with open(args.report, 'w', newline='', encoding='utf-8-sig') as fh:
            w = csv.writer(fh)
            w.writerow(['file', 'action', 'anchor', 'to', 'evidence'])
            w.writerows(actions)
        print(f'報告 → {args.report}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
