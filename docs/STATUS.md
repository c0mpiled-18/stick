# Stick：共同開發計畫與狀態

> **這一頁是全隊唯一的進度正本。** 做完一項就把 `[ ]` 改成 `[x]`、填上時間，推上來。卡住超過 10 分鐘就寫在最下面的「卡住」。
> 最後更新：20:02（Felix）：分工定案，三個人
> 細節看 `docs/build-plan.md`（影片、資料格式、旁白）與 `docs/intent-map.md`（架構圖）。

## 現在在哪

| | |
|---|---|
| 現在時間 | 20:02 |
| 功能凍結 | **21:45**（之後只錄影與交件） |
| 交件截止 | 22:45 |
| 目前進度 | repo、文件、Discord 機器人設定都好了，三個人都在團隊裡。**作品程式還沒開始。** |
| 下一個檢查點 | **21:00 三個人的東西接起來走一遍** |

## 我們在做什麼（30 秒）

最大客戶的 API 掛了，客服、工程、客戶成功、主管四個人各用自己的 agent。工程師隨口猜「大概 30 分鐘」，客戶就被告知「30 分鐘內修復」。

Stick 掛在團隊的 Discord 後面：誰講的、在哪個頻道講的，決定一句話算不算數。每個人的 agent 拿到同一包脈絡，沒確認的事不會對客戶承諾，每句話查得到誰確認的。

## 分工：產品分兩半，加上看得到的那一層

| | **記憶與取用** | **管控與查核** | **看得到的東西與交件** |
|---|---|---|---|
| 誰 | **Felix**（`Felix-Lai-12`） | **antonshuo** | **ryan**（`ryan234r32`） |
| 層 | 記憶層＋脈絡層，加上 Discord 機器人 | 權限層＋查核層，加上兩處呼叫模型的地方 | 網頁、假資料、影片、README |
| 分支 | `feat/memory` | `feat/control` | `feat/web` |
| 檔案 | `src/bot.js`、`src/db.js`、`src/context.js`、`config.json`、`package.json` | `src/authority.js`、`src/audit.js`、`src/extract.js`、`src/draft.js`、`scripts/compliance.js`、`data/facts.json` | `src/server.js`、`public/index.html`、`scripts/seed.js`、`README.md`（交件版）、旁白與錄影 |
| 回答的問題 | 存了什麼？這次拿什麼給 agent？ | 誰說了算？有沒有照做？ | 評審看到什麼？ |
| 做完的樣子 | Discord 講一句，訊息表多一筆；給決定表，組得出脈絡包 | 七種權限情況測過；給一份產出，判得出有沒有亂承諾 | 網頁每秒更新，看得到紀錄、決定板、文件、查核列 |

**不改別人的檔案。** 三個人從第一分鐘就能同時做：ryan 的 `scripts/seed.js` 先塞假資料，antonshuo 的權限與查核是純函式不用等任何人。

## 時間表

| 時間 | Felix | antonshuo | ryan |
|---|---|---|---|
| 20:02–20:10 | **一起**：確認下面「交界」。Felix 推 `package.json`、`.gitignore`、`src/db.js` 建表到 `main` | 同左 | 同左 |
| 20:10–21:00 | 機器人連線 → 訊息入庫 → 脈絡包 | 權限規則與測試 → 查核判定 → 挑出決定 → 寫文件 | 假資料 → 伺服器 → 網頁四個區塊 |
| **21:00** | **一起**：合併三個分支，從 Discord 講話走到網頁出現文件與查核列 | 同左 | 同左 |
| 21:10–21:30 | 修接通後的問題 | 跑「有無 Stick 各 5 次」，記下數字 | 開始寫英文旁白、錄每一鏡的備份 |
| 21:30–21:45 | 有餘力才做：情況變了，agent 停下來問 | 同左 | 整理會入鏡的畫面 |
| **21:45** | **功能凍結** | | |
| 21:45–22:15 | 錄影（Felix 當 Alice 操作 Discord） | 幫忙當 Ben 發言 | 錄旁白、剪接 |
| 22:15–22:45 | 上傳影片、repo 改公開、交件 | 最後檢查 repo | 交件版 README |

## 四層：各自一個檔案，各自能單獨測

| 層 | 回答什麼問題 | 檔案 | 輸入 → 輸出 | 誰寫 | 影片哪一鏡 |
|---|---|---|---|---|---|
| **記憶層** | 發生過什麼 | `src/db.js` | 四張只增不改的表 | Felix | 鏡 2 |
| **脈絡層** | 這一次 agent 到底看到了什麼 | `src/context.js` | `{決定表, 文件種類, 要不要用 Stick}` → `脈絡包` | Felix | 鏡 3 |
| **權限層** | 這句話算不算數、誰說了算 | `src/authority.js` | `{誰的角色, 哪個頻道, 做了什麼}` → `{結果狀態}` | antonshuo | 鏡 2 |
| **查核層** | 有沒有照做、根據哪一條 | `src/audit.js` | `{產出, 脈絡包, 事實表}` → `{判定, 違反了哪條, 依據連到哪則訊息}` | antonshuo | 鏡 4、6 |

**記憶與脈絡差在哪**：記憶是存下來的全部，只增不改；脈絡是每次開跑前從記憶挑出來給 agent 的那一小包。同一份記憶可以組出不同的脈絡。

三條分層的規矩：

1. **權限層不呼叫模型。** 一張表加一個函式，同樣的輸入永遠同樣的結果。模型只在 `extract.js` 挑出逐字片段，狀態由權限層決定。
2. **脈絡層不呼叫模型。** 它只讀決定表、組出一包。
3. **查核層不相信模型的自述，也不由寫文件的程式兼做。** `draft.js` 只負責叫模型寫；寫完把產出交給 `audit.js` 判定。

**這裡的「權限」指的是決策權**：誰能讓一句話變成定案或已確認。今晚不做「誰能看到哪些內容」的存取權限。

## 交界：20:10 前講定，之後誰都不改

要改的話先當面講，再用 `collab decide` 記下來，三個人同時改。

### 1. 資料表（Felix 定，放在 `src/db.js`）

SQLite 一個檔 `stick.db`，**只新增、不修改、不刪除**。

| 表 | 欄位 |
|---|---|
| `messages` | `id`、`channel`、`author`、`role`、`text`、`url`、`created_at` |
| `decisions` | `id`、`kind`、`statement`、`status`、`source_message_id`、`source_quote`、`premise`、`decided_by`、`decided_at`、`supersedes` |
| `transitions` | `id`、`decision_id`、`from_status`、`to_status`、`actor`、`trigger_message_id`、`at` |
| `outputs` | `id`、`doc`、`revision`、`requested_by`、`with_stick`、`context_packet`、`packet_hash`、`packet_tokens`、`text`、`cited_decisions`、`used_fact_ids`、`verdict`、`violations`、`question`、`at` |

| 欄位 | 可以是 |
|---|---|
| `role` | `support`、`engineering`、`cs`、`lead`、`bot` |
| `kind` | `rule`（規則）、`fact`（事實）、`commitment`（承諾） |
| `status` | `unconfirmed`、`decided`、`needs_recheck`、`superseded` |
| `doc` | `update`（客戶更新）、`handoff`（交接摘要） |
| `verdict` | `followed`、`violated`、`asked` |

`decisions.status` 存的是目前狀態；每次改變另外在 `transitions` 加一筆。

### 2. 每個人給別人用的函式

| 函式 | 檔案 | 誰寫 | 誰用 | 輸入 → 輸出 |
|---|---|---|---|---|
| `addMessage(row)`、`addDecision(row)`、`setStatus(decisionId, toStatus, actor, triggerMessageId)`、`saveOutput(row)` | `src/db.js` | Felix | 全部 | 寫入一筆 |
| `listMessages()`、`listDecisions()`、`listTransitions()`、`listOutputs()` | `src/db.js` | Felix | 全部 | 回傳陣列 |
| `buildContext({ decisions, doc, withStick })` | `src/context.js` | Felix | antonshuo | → `{ mustFollow, unconfirmed, needsRecheck, excluded, tokens, hash }`，每一項帶 `id`、`statement`、`decided_by`、`source_message_id` |
| `decide({ role, channel, action })` | `src/authority.js` | antonshuo | Felix | `action` 是 `say`、`approve`、`flag` → `{ status }` 或 `null`（沒權限） |
| `extract(messageText)` | `src/extract.js` | antonshuo | Felix | → `[{ quote, premise, kind }]`，`quote` 一定是原文的逐字片段 |
| `judge({ output, packet, facts })` | `src/audit.js` | antonshuo | antonshuo、ryan | → `{ verdict, violations, trace }` |
| `draft({ doc, requestedBy, withStick })` | `src/draft.js` | antonshuo | Felix（機器人收到 `!draft`） | 內部呼叫 `buildContext`、模型、`judge`、`saveOutput` → `{ text, verdict, question }` |
| `GET /api/state` | `src/server.js` | ryan | 網頁 | → `{ messages, decisions, transitions, outputs }` |

### 3. 設定（`config.json`，Felix）

| 設定 | 值 |
|---|---|
| 討論頻道 | `一般` |
| 定案頻道 | `dev-process` |
| 主管 | 伺服器擁有者 |
| 誰是哪個部門 | Discord 帳號或 webhook 名稱 → `support`／`engineering`／`cs`／`lead` |

模型：挑出決定用 `claude-haiku-5-5`，寫文件用 `claude-sonnet-5-5`。金鑰各自放自己電腦的 `.env`，**不進 repo**。Discord 的 token 只有 Felix 有，其他人用假資料開發，不需要它。

## 進度

### 地基
- [x] repo `c0mpiled-18/stick` 建立（19:21）
- [x] Discord 機器人：token 有效、讀訊息內容的開關已開、已在伺服器（18:39 驗過）
- [x] 文件推上 `docs/`（19:37）
- [x] 三個人都在團隊裡（20:00 查）
- [ ] 三個人都抓下 repo、跑過 `./.collab/setup.sh`
- [ ] `package.json`、`.gitignore`、`.env.example`、`src/db.js` 推上 `main`（Felix，20:10 前）

### Felix：記憶與取用
- [ ] `src/db.js`：四張表與上面的函式，沒有改與刪的函式
- [ ] `src/bot.js`：連線，在討論頻道打一句，終端機印出作者、頻道、連結
- [ ] 訊息入庫；呼叫 `extract` 與 `decide` 把結果寫進決定表
- [ ] ✅ 反應：呼叫 `decide`，有權才改狀態
- [ ] `src/context.js`：`buildContext`，兩次呼叫結果相同，指紋對得上
- [ ] `!draft update`、`!draft handoff` 接到 `draft()`

### antonshuo：管控與查核
- [ ] `src/authority.js`：`decide`，七種情況各測一次（規則表在 `docs/build-plan.md` 第 5 節）
- [ ] `data/facts.json`：事實表（`docs/build-plan.md` 第 6 節）
- [ ] `src/audit.js`：`judge`，用事實編號與禁用字判定有沒有亂承諾
- [ ] `src/extract.js`：模型挑出決定，非逐字片段丟掉
- [ ] `src/draft.js`：寫客戶更新與交接摘要
- [ ] **一做好就先跑對照組**：沒有 Stick 時 agent 會不會把猜測寫成承諾
- [ ] `scripts/compliance.js`：有無 Stick 各 5 次，印出結果

### ryan：看得到的東西與交件
- [ ] `scripts/seed.js`：假資料（一條規則、兩筆未確認、一份產出），讓大家不用等機器人
- [ ] `src/server.js`：`GET /api/state` 與靜態網頁
- [ ] 網頁四個區塊：記憶層紀錄、決定板、文件與查核列、點開看脈絡包。每秒更新，只做 1280 寬
- [ ] 英文旁白稿（`docs/build-plan.md` 第 7 節有草稿）
- [ ] 錄影、上傳 YouTube（選「不公開」）
- [ ] 交件版英文 README

### 一起
- [ ] 21:00 三個分支接通
- [ ] （有餘力）情況變了 → agent 停下來問 → 新決定取代舊決定
- [ ] repo 改公開、交件、用無痕視窗確認打得開

## 來不及時先放掉什麼

現在離凍結只剩 100 分鐘，程式從零開始。由下往上放，最上面的最後才放：

1. Discord 講話 → 決定表（誰講的才算數）
2. 打得開的脈絡包
3. 文件下方的查核列與判定
4. 有無 Stick 各 5 次的數字
5. 情況變了，agent 停下來問（**預設不做，21:30 有餘力才做**）
6. 新決定取代舊決定、拿掉一條規則重跑（**不做**）

**21:00 接不通的話**：全部時間拿來接通第 1 到 3 項，第 4 項用腳本直接跑、不經過 Discord。

## 規則

完整版在 `README.md`。最重要的五條：

- 18:45 之前沒有任何作品程式，不要從別的地方貼舊程式進來。
- 金鑰與 token 不進 repo。
- 各自在自己的分支寫、不改別人的檔案，21:00 合併一次。
- 同一個問題修兩次不過，停下來在這一頁寫下卡在哪。
- `.collab/` 是開發工具，不是作品。

## 還沒確定的事

| 事情 | 誰來確認 | 什麼時候 |
|---|---|---|
| 機器人實際連線後讀不讀得到兩個頻道 | Felix | 20:25 前 |
| 沒有 Stick 時，agent 真的會把猜測寫成承諾嗎 | antonshuo | `draft.js` 一做好就跑 |
| 影片裡四個發言者：Felix 當 Alice，antonshuo 當 Ben，其餘兩位用真人還是 webhook | 三人當面講 | 21:30 前 |

## 卡住

（寫：幾點、誰、卡在哪、試過什麼）
