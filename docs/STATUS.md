# Stick：共同開發計畫與狀態

> **這一頁是全隊唯一的進度正本。** 做完一項就把 `[ ]` 改成 `[x]`、填上時間，推上來。卡住超過 10 分鐘就寫在最下面的「卡住」。
> 最後更新：20:40（Felix）：`feat/ingest` 併入 `feat/access` 的 `review.js`，真模型走完審稿、遮蔽、重審；頻道改認三個正式頻道。前一筆：20:16（Felix）：A 段五項完成、已接上 B 的 db.js。前一筆：20:10（Felix）：分工填上人名、地基推上 main。前一筆 20:05（antonshuo）：場景改為公關審稿，見下方「19:50 改了什麼」；分工待 Felix 依新場景更新
> 細節看 `docs/build-plan.md`（影片、資料格式、旁白）與 `docs/intent-map.md`（架構圖）。

## 現在在哪

| | |
|---|---|
| 現在時間 | 20:05 |
| 功能凍結 | **21:45**（之後只錄影與交件） |
| 交件截止 | 22:45 |
| 目前進度 | repo 建好、文件推上來、Discord 機器人設定完成。**作品程式還沒開始。** |
| 下一個檢查點 | **21:00 三段接起來走一遍** |

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

## 分工（20:10 Felix 這邊更新）

照資料流切成三段，三個人不改同一個檔案。**A＝Felix、B＝antonshuo、C＝ryan**（對應 Felix 20:02 說的：他做進來與脈絡、antonshuo 做權限、ryan 做畫面；有出入當面講，改這一行）。

| 段（誰／分支） | 做什麼 | 檔案 |
|---|---|---|
| A：話怎麼進來（**Felix**／`feat/ingest`） | 機器人、訊息入庫、整理成脈絡並標敏感等級、發事件 | `src/bot.js`、`src/sources/discord.js`、`src/ingest.js`、`config/channels.json` |
| B：誰看得到什麼（**antonshuo**／`feat/access`） | 資料庫、讀取口、遮蔽、seed 與 demo 資料、兩支腳本 | `src/db.js`、`src/access.js`、`config/people.json`、`scripts/seed.js`、`scripts/compare.js`、`scripts/leak-check.js` |
| C：審稿與畫面（**ryan**／`feat/agent`） | 審稿、網頁、重審 | `src/review.js`、`src/server.js`、`public/index.html` |

B 不用等任何人，開工先推 `src/db.js` 與 seed（build-plan 第 6 節），另外兩段就能用假資料往下做。

## 時間表

| 時間 | A | B | C |
|---|---|---|---|
| 19:50–20:05 | **一起**：確認下面「交界」。B 推 `src/db.js` 與 seed | 同左 | 同左 |
| 20:05–20:55 | 機器人連線 → 訊息入庫 → 整理成脈絡 → 發事件 | 讀取口 → 遮蔽 → 測試 | 審稿（用 seed）→ 引用比對 |
| 20:40–21:05 | （續） | 兩支腳本、demo 發言腳本 | 網頁 |
| **21:00** | **一起**：合併三個分支，從 Discord 講話走到網頁出現審稿結果 | 同左 | 同左 |
| 21:15–21:40 | 事件接到重審 | 跑「有無 Stick 各 5 次」與洩露檢查 | 重審 |
| 21:40–21:45 | 錄備份 | 同左 | 同左 |
| 21:45–22:15 | 錄影 | README | 錄影 |
| 22:15–22:45 | 上傳影片、repo 改公開、交件 | 同左 | 同左 |

## 三層：各自一個檔案，各自能單獨測

沿用 Felix 19:52 定的分層原則（每層一個檔案、只透過輸入輸出往來、查核不信模型自述），套到新場景：

| 層 | 回答什麼問題 | 檔案 | 輸入 → 輸出 | 誰寫 | 影片哪一鏡 |
|---|---|---|---|---|---|
| **脈絡層** | 發生過什麼、敏感到什麼程度 | `src/ingest.js`（＋`src/db.js` 存） | `一則訊息` → `脈絡（摘要、主題、等級、原話）` | A | 鏡 2 |
| **權限層** | 誰看得到哪條 | `src/access.js` | `{viewer, topics}` → `{items, excludedCount}`；`{viewer, review}` → `遮蔽後的審稿` | B | 鏡 2、4 |
| **審稿層** | 這份稿子跟現況有沒有衝突、要改什麼 | `src/review.js` | `{draft, 主管的脈絡包}` → `{verdict, issues, 引用}` | C | 鏡 3、5 |

分層的規矩：

1. **權限層不呼叫模型。** 一張職位表、一張頻道表加幾個純函式，同樣的輸入永遠得到同樣的結果。
2. **模型只能把敏感等級調高。** `ingest.js` 寫入時取 `max(頻道下限, 模型判斷)`。
3. **除了 `access.js`，沒有任何檔案直接查 `context_items`。** 審稿、網頁、機器人都走讀取口。
4. **審稿不相信模型的自述。** 引用由程式逐字比對，不符就丟；洩露由 `scripts/leak-check.js` 掃。

**這裡的「權限」指的是存取權**：誰看得到哪些內容。19:52 版寫的「今晚不做存取權限、所有成員看到的脈絡相同」已由本次改版取代。

## 交界：20:10 前講定，之後誰都不改

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
- [x] 頻道：20:38 起伺服器有 `eng-general`（internal）、`eng-incident`（restricted）、`pr-drafts`（交稿）三個正式頻道，`config/channels.json` 的別名已清空。**`discussion`、`decision`、`一般` 不再進脈絡**，C1、C4 的 webhook 要指到 `#eng-general`（20:40）
- [x] `package.json`、`.env.example` 已在 `main`（20:10）。資料庫用 Node 內建的 `node:sqlite`，不用另外裝套件；`npm install` 後 `npm test` 跑測試。**三個人都不要再改 `package.json`，要加套件先講。**

### A：話怎麼進來
- [x] `src/bot.js`：連線，在 `discussion` 打一句，終端機印出作者、角色、頻道、連結（20:13 實測；分支 `feat/ingest`）
- [x] 訊息入庫，機器人自己與沒登記的 webhook 不入庫（20:15，用 `feat/access` 的 `db.js` 實測）
- [x] `src/ingest.js`：模型整理成脈絡，非逐字原話丟掉（20:07，真模型每則 1 到 2 秒）
- [x] 等級＝`max(頻道下限, 模型判斷)`（測試守著）
- [x] 寫完脈絡發 `context_added` 事件；`payload` 是 `{ context_item_ids, topics, message_id }`
- [ ] `!review` 指令接到審稿：程式已接上（`feat/ingest` `5d2fc9b`）。20:40 用真模型直接呼叫函式驗過：v1 → `block` 三條、Erin 的版本遮掉兩條、沒有 Stick → `ok`、v2 → `ok`、C4 進來 → v2 重審成 `needs_change`。**還沒驗：在 Discord `#pr-drafts` 真的打 `!review`**（要有人交稿）

### B：誰看得到什麼
> **A、C 現在就能用**：`git merge origin/feat/access`（或 `git checkout origin/feat/access -- src/db.js src/access.js config/people.json scripts/`），再 `npm run seed`。多出來的讀取函式：`listMessages`、`getMessage`、`getDraft`、`listReviews(draftId)`；`insertDraft` 給 `parent_id` 會自動算 `revision`。測試用 `openStore(':memory:')`。
- [x] `src/db.js`：五張表與寫入、查詢函式；UPDATE／DELETE 由 trigger 擋（20:12）
- [x] `config/people.json` 與 `scripts/seed.js`：`npm run seed`、`--v2`、`--c4`、`--reset`（20:14）
- [x] `src/access.js`：讀取口、主管對照、遮蔽；另有 `sensitivityOfItems(ids)` 給 C 標問題等級（20:14）
- [x] 測試：每個職位 × 每個等級，16 個全過（20:14）
- [ ] `scripts/compare.js`：有無 Stick 各 5 次。**程式已寫好（20:16），等 C 的 `src/review.js` 合進來才能跑**：`node --env-file=.env scripts/compare.js`
- [x] `scripts/leak-check.js`：Erin 視角限閱原話出現 0 次；故意標錯等級的審稿抓得到（20:16）。C 的伺服器好了加 `--url .../api/state?viewer=Erin` 一起掃
- [x] demo 發言腳本 `scripts/speak.js`（20:25，在 `feat/access`）：`node --env-file=.env scripts/speak.js base`（C1–C3）、`C4`、`v1`；`--dry` 只印不送。**20:28 已用 webhook 實際送出測試訊息（HTTP 200）。** 目前只有 `DISCORD_WEBHOOK_ENG_INCIDENT`，指到新開的 `#eng-incident` 頻道（20:35 實測送出；機器人設定直接認得這個名字，不用加別名）。C2、C3 可發，C1、C4 還缺 `discussion` 的 webhook。seed 的事件格式已對齊 A：`{ context_item_ids, topics, message_id }`。
  - 設定：在 Discord 對要用的頻道「編輯頻道 → 整合 → Webhook → 新 Webhook → 複製網址」，放進自己的 `.env`（不進 repo、不貼聊天）：`DISCORD_WEBHOOK_ENG_GENERAL`、`DISCORD_WEBHOOK_ENG_INCIDENT`、選填 `DISCORD_WEBHOOK_PR_DRAFTS`。變數名照 demo 的頻道角色取，網址指到實際頻道就好（沿用 `一般`／`dev-process` 也可以）。
  - **給 Felix（A）**：webhook 訊息的 `author.bot` 是 true、`message.webhookId` 有值。機器人要把「有 `webhookId` 且名字在 `config/people.json` 別名裡」的訊息當成人的訊息，不能一律略過，否則 Dana 的話進不了脈絡。

### C：審稿與畫面
- [x] `src/review.js`：組脈絡包、審稿、引用逐字比對、問題等級（**20:38 antonshuo 先做了，在 `feat/access`**；`reviewDraft`、`onContextAdded`、`startReReviewLoop`；假模型 8 個測試全過，**真模型還沒跑**：antonshuo 本機沒有 `ANTHROPIC_API_KEY`）。**ryan 不用再寫這支，專心做 `src/server.js` 與網頁**；給 Erin 的畫面記得先過 `redactReviewFor`
- [ ] `src/server.js` 與網頁：切換身份、脈絡、稿件、審稿結果、點引用跳回原訊息
- [x] `onContextAdded`：主題相關的稿件重審（在 `src/review.js`；伺服器或機器人呼叫 `startReReviewLoop()` 就會自動跑）

### 一起
- [ ] 21:00 三段接通
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

**21:00 接不通的話**：第 4、5 項直接放掉，全部時間拿來接通第 1 到 3 項。

## 規則

- 18:45 之前沒有任何作品程式，這是主辦的規定，不要從別的地方貼舊程式進來。
- 金鑰與 token 不進 repo。
- 各自在自己的分支寫，21:00 合併一次。
- 同一個問題修兩次不過，停下來在這一頁寫下卡在哪。
- `.collab/` 是開發工具，不是作品。

## 還沒確定的事

| 事情 | 誰來確認 | 什麼時候 |
|---|---|---|
| 能不能開三個新頻道並讓機器人讀到；不行就用 `一般`＝`eng-general`、`dev-process`＝`eng-incident`、網頁交稿 | Felix | 20:05 前 |
| 沒有 Stick 時，審稿 agent 真的會說稿子沒問題嗎 | C | `review.js` 一做好就跑 |
| 影片裡四個發言者，哪幾個是真人帳號 | 三人當面 | 21:15 前 |

## 卡住

- 20:40 Felix：**重審只能有一個人觸發。** 機器人整理出新脈絡後會直接呼叫 `onContextAdded`（事件要包成 `{ payload: { context_item_ids } }`，傳在頂層會被當成沒有新脈絡，已修）。`src/server.js` **不要**再開 `startReReviewLoop()`，否則同一條新脈絡會重審兩次。
- 20:25 Felix：`config/people.json` 我在 `feat/ingest` 加了兩個別名（`felix425.` → Alice、`shuozhan`／`碩展` → Ben），只動那兩行。**antonshuo 合併時留意這個檔**。ryan 的 Discord 帳號還不知道（他沒在伺服器發過言），要當 Erin 的話把帳號名稱加進 Erin 的 `aliases`；不加就用 `scripts/speak.js` 的 webhook 扮 Erin。

- 20:15 Felix：分支 `feat/control`（20:07 推的 `authority.js`、`audit.js`）是照舊場景寫的，新場景用不到。確認後請刪掉或標明不合併，免得 21:00 合錯。

（寫：幾點、誰、卡在哪、試過什麼）
