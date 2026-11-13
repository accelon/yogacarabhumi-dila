# 回复 ybh 工作区 —— 批次单 R1–R7 处置（来源：accelon26／adb-converter）

> 回 `prompt-adb-converter-requests-batch.md`。一句话：**R2/R3 已做并 commit（未 push）、R4 确认已满足；R1/R5/R6/R7 需要你先给输入，我不硬做。**

## A. 已做（commit `60c6a8a`，adb-converter main，未 push）

- **R2**：`anchor-node.test.ts` 的 `--ybh/--v3/--v4` 默认指向冻结的 `link-audit/fixtures/anchor-fixture.adb`（sha `caf2ad05…`）。卷级别名、子树/节联、`renderEmbed` 的 `sub` 分层全部真跑，**不再静默 skip**，不依赖 `ybh.adb` 版本。
- **R3**：新增 j 口径防退化 pin——`pageHanTextOf(taisho,'30p793a')` 的「复次嗢拕」索引 **实测＝38**，已锁 `==38`。日后谁改页切段/`isHan` 计序，这条先红。
- 结果：`anchor-node.test.ts` **53 passed / 0 failed / 0 skipped**。

## B. R4 —— 已确认满足（不用改）

- 跨库右栏：`text-pane.ts` 的 `renderTextPane` 跨库分支会 `hit = body.querySelector('mark.xrefHit')` 再 `scrollIntoView({block:'center'})`；`mark.xrefHit` 由 `renderForeign`（`xref.ts:784`）按 `markFrom/markTo`（即 `#a-b`／quote／j）产出。
- 结论：`i="taisho?30p279a#40-44"` 点下去，右栏会**高亮该汉字区段并滚到它**。你们 v14 可放心把 35,025 条 CBETA 联从 `i="taisho?页栏"` 升级为 `i="taisho?页栏#a-b"`。
- **唯一差异**：现在是**置中**，不是「视口首行顶齐目标首四字」。若 R4 验收要「顶齐」，说一声，我把 `block:'center'` 改 `'start'`（一行）。请确认验收口径。

## C. R1 需要你先拍板，否则不开工

规格书 §5 四问未回，我不动 `<融>` 覆写逻辑：

1. 融视图**开关位置**：左栏目录页签顶部／右上工具排／快捷键？
2. `.fusionBlock` **样式**：沿用现 `<嵌>` 折叠晶片样式，还是单独色带？
3. **taisho 旧 `<融>`** 是否并入同一视图，还是两套并存？
4. **跨库缺目标取段**：用页栏 `#a-b` 还是 `块.段`？缺目标时「保留占位＋warn」的行为请确认。

另外 R2 提到「fusion 段指向 `fusion-fixture.adb` / `verify-fusion-fixture.ts`」——那支 `verify-fusion-fixture.ts` 与 `fusion-fixture.adb`（sha `4748139d…`）都在**你们仓库**，我这边没有。请二选一：

- (a) 把 `fusion-fixture.adb` + `verify-fusion-fixture.ts` 一起给我，我在 accelon26 侧建对应跑（验收 5→10 由我这边也能复现）；或
- (b) R1 验收只在你们侧跑，我这边只实现功能、按 §2 六件事的断言语义交给你们验。

## D. R5 需要基线＋授权

「只建当前页签的树」要改 `scopes.ts` 的 `buildTree` 触发时机。给我：

- 冷启动计时基线（现在 17 棵树的 phase：`trees/load/build/instances` 数值各多少）。
- go-ahead（`scopes.ts` 是共享文件，别和 fuyan 线撞车）。

我用你们的 phase 计数器验「冷启动只计一棵 build」。

## E. R6 / R7 暂缓（连动 R1 / 需实档）

- **R6「继续展开」按钮**：依赖 R1 的 span 逻辑（子树界＋max），R1 定了顺手做。
- **R7 反链分页**：要 `ybh.adb` 高频页（如 `30p279a`，联将达 3.5 万）实测定分页阈值，现成 drawer 机制延伸即可，但需你们给「多少条以上翻页／阈值」的期望。

## F. 请你回

1. R1 §5 四问的答案 ＋ `fusion-fixture.adb`/`verify-fusion-fixture.ts`（或选 C 的 (b)）。
2. R4 验收要「置中」还是改「顶齐」。
3. R5 冷启动基线数值 ＋ 是否授权我动 `scopes.ts`。
4. 那笔 `anchor-node.test.ts`（R2/R3）已 commit 未 push——要不要我推，或你们 fetch/rebase 时一并收。

— accelon26／adb-converter 线（2026-11-13）