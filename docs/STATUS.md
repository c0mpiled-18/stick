# Stick：共同開發計畫與狀態

> **這一頁是全隊唯一的進度正本。** 做完一項就把 `[ ]` 改成 `[x]`、填上時間，推上來。卡住超過 10 分鐘就寫在最下面的「卡住」。
> 最後更新：19:50（場景改為公關審稿，見下方「19:50 改了什麼」）
> 細節看 `docs/build-plan.md`（影片、資料格式、旁白）與 `docs/intent-map.md`（架構圖）。

## 現在在哪

| | |
|---|---|
| 現在時間 | 19:50 |
| 功能凍結 | **21:45**（之後只錄影與交件） |
| 交件截止 | 22:45 |
| 目前進度 | repo 建好、文件推上來、Discord 機器人設定完成。**作品程式還沒開始。** |
| 下一個檢查點 | **21:05 三段接起來走一遍** |

## 19:50 改了什麼

| | 舊（`0f85b22`） | 新 |
|---|---|---|
| 場景 | 最大客戶 API 掛了，客戶更新 | 工程頻道有延期與資安事件，公關專員的新聞稿與現況衝突 |
| 權限的意思 | 誰講的話算數（已確認／未確認） | **誰看得到什麼**：頻道給敏感等級下限，職位決定看得到哪一級 |
| 每個人拿到的脈絡 | 所有人同一包 | 依職位不同，主管看到的比下屬多 |
| Agent 做什麼 | 自己寫客戶更新，程式查它有沒有亂承諾 | **審人寫的稿子**，用主管的權限比對最新脈絡，給主管建議 |
| 主管做什麼 | 定規則、按 ✅ | 收審稿結果；下屬拿到遮蔽版 |
| 資料來源 | Discord | Slack 或 Discord（今晚 demo 用 Discord，Slack 同介面） |
| 人數 | 兩人 | 三人 |

## 我們在做什麼（30 秒）

工程頻道剛討論出 Smart Export 要延期，還發生了一起資料外洩；法務說週五前不對外談資安。公關專員 Erin 不知道，新聞稿寫「明天上線，我們從未發生資安事件」。

Stick 讀團隊的 Slack／Discord，把對話整理成帶敏感等級的脈絡。Erin 交稿時，她主管 Alice 的審稿 agent 用 **Alice 的權限**比對最新脈絡：先擋下，指出兩個衝突，每條附原訊息。Erin 拿到的版本只看得到她有權知道的那條。之後工程又有新討論，已過審的稿子會自動重審。

## 分工：照資料流切成三段

交界是**脈絡表**與**讀取口** `retrieveContext(viewer)`。A 寫進去，B 是唯一的讀取口，C 只透過 B 拿脈絡。三人不改同一個檔案。

| | A：話怎麼進來 | B：誰看得到什麼 | C：審稿與畫面 |
|---|---|---|---|
| 誰 | **Felix** | **第三位隊友（待確認）** | **隊友（待確認）** |
| 分支 | `feat/ingest` | `feat/access` | `feat/agent` |
| 檔案 | `src/bot.js`、`src/sources/discord.js`、`src/ingest.js`、`config/channels.json` | `src/db.js`、`src/access.js`、`config/people.json`、`scripts/seed.js`、`scripts/compare.js`、`scripts/leak-check.js` | `src/review.js`、`src/server.js`、`public/index.html` |
| 做完的樣子 | 在 Discord 講一句話，脈絡表多一筆，等級正確，事件表多一筆 | Erin 拿到 1 條、Alice 拿到 3 條；遮蔽函式通過測試 | 交稿後產出審稿結果，網頁切換身份看得到完整版與遮蔽版 |

B 與 C 不用等 A：開工先用 `scripts/seed.js` 塞 demo 資料（build-plan 第 6 節），就能獨立往下做。B 的工作最輕，所以也負責 demo 發言腳本、英文旁白與 README 初稿。

## 時間表

| 時間 | A（Felix） | B | C |
|---|---|---|---|
| 19:50–20:05 | **一起**：確認下面「交界」。B 推 `src/db.js` 與 seed | 同左 | 同左 |
| 20:05–20:55 | 機器人連線 → 訊息入庫 → 整理成脈絡 → 發事件 | 讀取口 → 遮蔽 → 測試 | 審稿（用 seed）→ 引用比對 |
| 20:40–21:05 | （續） | 兩支腳本、demo 發言腳本 | 網頁 |
| **21:05** | **一起**：合併三個分支，從 Discord 講話走到網頁出現審稿結果 | 同左 | 同左 |
| 21:15–21:40 | 事件接到重審 | 跑「有無 Stick 各 5 次」與洩露檢查 | 重審 |
| 21:40–21:45 | 錄備份 | 同左 | 同左 |
| 21:45–22:15 | 錄影 | README | 錄影 |
| 22:15–22:45 | 上傳影片、repo 改公開、交件 | 同左 | 同左 |

## 交界：20:05 前講定，之後誰都不改

SQLite 一個檔 `stick.db`，五張表，**只新增、不修改、不刪除**。

| 表 | 欄位 |
|---|---|
| `messages` | `id`、`source`、`channel`、`author`、`role`、`text`、`url`、`created_at` |
| `context_items` | `id`、`summary`、`topics`、`sensitivity`、`source_message_id`、`source_quote`、`created_at` |
| `drafts` | `id`、`author`、`title`、`text`、`revision`、`parent_id`、`created_at` |
| `reviews` | `id`、`draft_id`、`reviewer`、`trigger`、`with_stick`、`context_packet`、`packet_hash`、`verdict`、`issues`、`at` |
| `events` | `id`、`type`、`payload`、`at` |

固定的值：

| 欄位 | 可以是 |
|---|---|
| `source` | `discord`、`slack` |
| `role` | `pr_staff`、`pr_lead`、`engineering`、`legal`、`bot` |
| `sensitivity` | `public`、`internal`、`restricted` |
| `trigger` | `submitted`、`context_added` |
| `verdict` | `ok`、`needs_change`、`block` |
| `events.type` | `context_added` |

函式交界：

- `src/db.js`（B）：`insertMessage`、`insertContextItem`、`insertDraft`、`insertReview`、`insertEvent`、`listDrafts()`、`latestReview(draftId)`、`listEvents(sinceId)`
- `src/access.js`（B）：`retrieveContext(viewer, { topics })` → `{ items, excludedCount }`；`getManager(user)`；`clearanceOf(user)`；`redactReviewFor(viewer, review)`
- `src/ingest.js`（A）：`ingestMessage(msg)` → 新增的脈絡 id 陣列；寫完發 `context_added` 事件
- `src/review.js`（C）：`reviewDraft({ draftId, trigger, withStick })` → 審稿列；`onContextAdded(event)` → 重審的稿件 id 陣列。機器人收到 `!review <稿件>` 就先 `insertDraft` 再呼叫它

**硬規則**：除了 `src/access.js`，沒有任何檔案直接查 `context_items`。

模型：整理脈絡用 `claude-haiku-5-5`，審稿用 `claude-sonnet-5-5`。金鑰各自放自己電腦的 `.env`，**不進 repo**。

## 進度

### 地基
- [x] repo `c0mpiled-18/stick` 建立（19:21）
- [x] Discord 機器人：token 有效、讀訊息內容的開關已開、已在伺服器（18:39 驗過）
- [x] 文件推上 `docs/`（19:37）
- [x] 場景改為公關審稿，文件更新（19:50）
- [ ] 兩位隊友接受邀請、抓下 repo、跑 `./.collab/setup.sh`
- [ ] 開 `eng-general`、`eng-incident`、`pr-drafts` 三個頻道，機器人讀得到（Felix）
- [ ] `package.json`、`.env.example`（Felix）

### A：話怎麼進來（Felix）
- [ ] `src/bot.js`：連線，在 `eng-general` 打一句，終端機印出作者、頻道、連結
- [ ] 訊息入庫，機器人自己的訊息不入庫
- [ ] `src/ingest.js`：模型整理成脈絡，非逐字原話丟掉
- [ ] 等級＝`max(頻道下限, 模型判斷)`
- [ ] 寫完脈絡發 `context_added` 事件
- [ ] `!review` 指令接到 C

### B：誰看得到什麼（第三位隊友）
- [ ] `src/db.js`：五張表與寫入、查詢函式
- [ ] `config/people.json` 與 `scripts/seed.js`
- [ ] `src/access.js`：讀取口、主管對照、遮蔽
- [ ] 測試：每個職位 × 每個等級
- [ ] `scripts/compare.js`：有無 Stick 各 5 次
- [ ] `scripts/leak-check.js`：Erin 視角限閱原話出現 0 次
- [ ] demo 發言腳本（webhook 扮 Dana）

### C：審稿與畫面（隊友）
- [ ] `src/review.js`：組脈絡包、審稿、引用逐字比對、問題等級
- [ ] `src/server.js` 與網頁：切換身份、脈絡、稿件、審稿結果、點引用跳回原訊息
- [ ] `onContextAdded`：主題相關的稿件重審

### 一起
- [ ] 21:05 三段接通
- [ ] 重審：第 2 版過審後，新訊息讓它被改判
- [ ] 錄影（2 分鐘內）
- [ ] README（英文）
- [ ] repo 改公開、交件、用無痕視窗確認打得開

## 來不及時先放掉什麼

由下往上放，最上面的最後才放：

1. 脈絡依職位過濾＋審稿抓到衝突
2. 遮蔽版
3. 點引用跳回原訊息
4. 有無 Stick 各 5 次的數字
5. 重審（先放掉重跑，只留標記）
6. 重審時標記主管（已預設不做）

**21:05 接不通的話**：第 4、5 項直接放掉，全部時間拿來接通第 1 到 3 項。

## 規則

- 18:45 之前沒有任何作品程式，這是主辦的規定，不要從別的地方貼舊程式進來。
- 金鑰與 token 不進 repo。
- 各自在自己的分支寫，21:05 合併一次。
- 同一個問題修兩次不過，停下來在這一頁寫下卡在哪。
- `.collab/` 是開發工具，不是作品。

## 還沒確定的事

| 事情 | 誰來確認 | 什麼時候 |
|---|---|---|
| 新場景三人都同意 | 三人當面 | 19:55 前 |
| B、C 各是哪位隊友 | 三人當面 | 19:55 前 |
| 能不能開三個新頻道並讓機器人讀到；不行就用 `一般`＝`eng-general`、`dev-process`＝`eng-incident`、網頁交稿 | Felix | 20:05 前 |
| 沒有 Stick 時，審稿 agent 真的會說稿子沒問題嗎 | C | `review.js` 一做好就跑 |
| 影片裡四個發言者，哪幾個是真人帳號 | 三人當面 | 21:15 前 |

## 卡住

（寫：幾點、誰、卡在哪、試過什麼）
