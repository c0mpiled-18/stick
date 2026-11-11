# Stick：共同開發計畫與狀態

> **這一頁是全隊唯一的進度正本。** 做完一項就把 `[ ]` 改成 `[x]`、填上時間，推上來。卡住超過 10 分鐘就寫在最下面的「卡住」。
> 最後更新：19:52（Felix 這邊）：補上四層的分工與介面
> 細節看 `docs/build-plan.md`（影片、資料格式、旁白）與 `docs/intent-map.md`（架構圖）。

## 現在在哪

| | |
|---|---|
| 現在時間 | 19:45 |
| 功能凍結 | **21:45**（之後只錄影與交件） |
| 交件截止 | 22:45 |
| 目前進度 | repo 建好、文件推上來、Discord 機器人設定完成。**作品程式還沒開始。** |
| 下一個檢查點 | **20:50 兩半接起來走一遍** |

## 我們在做什麼（30 秒）

最大客戶的 API 掛了，客服、工程、客戶成功、主管四個人各用自己的 agent。工程師隨口猜「大概 30 分鐘」，客戶就被告知「30 分鐘內修復」。

Stick 掛在團隊的 Discord 後面：誰講的、在哪個頻道講的，決定一句話算不算數。每個人的 agent 拿到同一包脈絡，沒確認的事不會對客戶承諾，每句話查得到誰確認的。

## 分工：照資料流切成前後兩半

交界是**決定表**。前半負責把資料寫進去，後半只讀它。兩邊不改同一個檔案。

| | 前半：話怎麼進來、怎麼算數 | 後半：agent 怎麼用、怎麼查 |
|---|---|---|
| 誰 | **Felix** | **隊友（待確認）** |
| 分支 | `feat/ingest` | `feat/agent` |
| 檔案 | `src/bot.js`、`src/db.js`、`src/authority.js`、`src/extract.js`、`config.json` | `src/context.js`、`src/draft.js`、`src/audit.js`、`src/server.js`、`public/index.html`、`scripts/` |
| 做完的樣子 | 在 Discord 講一句話，決定表多一筆，狀態正確 | 給一份決定表，產出客戶更新與查核結果，網頁看得到 |

後半不用等前半：開工先用 `scripts/seed.js` 塞一份假的決定表（一條規則、兩筆未確認），就能獨立往下做。

第三個人加入的話：負責 demo 資料、兩支量測腳本、英文旁白、README、錄影。

## 時間表

| 時間 | 前半（Felix） | 後半（隊友） |
|---|---|---|
| 19:45–19:55 | **一起**：確認下面「交界」的欄位。Felix 推 `src/db.js` 建表 | 同左 |
| 19:55–20:50 | 機器人連線 → 訊息入庫 → 權限規則 → 挑出決定 | 假資料 → 脈絡包 → 寫文件 → 查核判定 → 網頁 |
| **20:50** | **一起**：合併兩個分支，從 Discord 講話走到網頁出現文件 | 同左 |
| 21:00–21:15 | 記憶層紀錄頁、錄備份 | 跑「有無 Stick 各 5 次」 |
| 21:15–21:45 | **一起**：待重查、停下來問、取代 | 同左 |
| 21:45–22:15 | 錄影 | README |
| 22:15–22:45 | 上傳影片、repo 改公開、交件 | 同左 |

## 四層：各自一個檔案，各自能單獨測

產品就是這四層。每一層是一個檔案、一組純函式，**不互相呼叫內部、只透過下面的輸入輸出往來**。影片也是照這四層演的。

| 層 | 回答什麼問題 | 檔案 | 輸入 → 輸出 | 誰寫 | 影片哪一鏡 |
|---|---|---|---|---|---|
| **記憶層** | 發生過什麼 | `src/db.js` | 四張只增不改的表 | Felix | 鏡 2 |
| **權限層** | 這句話算不算數、誰說了算 | `src/authority.js` | `{誰的角色, 哪個頻道, 做了什麼}` → `{結果狀態}` | Felix | 鏡 2 |
| **脈絡層** | 這一次 agent 到底看到了什麼 | `src/context.js` | `{決定表, 文件種類, 要不要用 Stick}` → `脈絡包` | 後半 | 鏡 3 |
| **查核層** | 有沒有照做、根據哪一條 | `src/audit.js` | `{產出, 脈絡包, 事實表}` → `{判定, 違反了哪條, 依據連到哪則訊息}` | 後半 | 鏡 4、6 |

三條分層的規矩：

1. **權限層不呼叫模型。** 它是一張表加一個函式，同樣的輸入永遠得到同樣的結果。模型只在 `extract.js` 挑出逐字片段，狀態由權限層決定。
2. **脈絡層不呼叫模型，也不寫資料庫。** 它只讀決定表、組出一包。存檔由呼叫它的人做。
3. **查核層不相信模型的自述，也不由寫文件的那支程式兼做。** `draft.js` 只負責叫模型寫；寫完把產出交給 `audit.js` 判定。兩者分開，才能說「不是模型自己說了算」。

`src/draft.js` 是把這幾層串起來的地方：拿脈絡包（脈絡層）→ 叫模型寫 → 交給查核層判定 → 存進記憶層。它本身不含任何判斷規則。

**這裡的「權限」指的是決策權**：誰能讓一句話變成定案或已確認。今晚不做「誰能看到哪些內容」的存取權限，所有成員看到的脈絡相同。被問到要這樣回答，不要說成有做存取控管。

## 交界：19:55 前講定，之後誰都不改

SQLite 一個檔 `stick.db`，四張表，**只新增、不修改、不刪除**。

| 表 | 欄位 |
|---|---|
| `messages` | `id`、`channel`、`author`、`role`、`text`、`url`、`created_at` |
| `decisions` | `id`、`kind`、`statement`、`status`、`source_message_id`、`source_quote`、`premise`、`decided_by`、`decided_at`、`supersedes` |
| `transitions` | `id`、`decision_id`、`from_status`、`to_status`、`actor`、`trigger_message_id`、`at` |
| `outputs` | `id`、`doc`、`revision`、`requested_by`、`with_stick`、`context_packet`、`packet_hash`、`packet_tokens`、`text`、`cited_decisions`、`used_fact_ids`、`verdict`、`question`、`at` |

固定的值：

| 欄位 | 可以是 |
|---|---|
| `role` | `support`、`engineering`、`cs`、`lead`、`bot` |
| `kind` | `rule`（規則）、`fact`（事實）、`commitment`（承諾） |
| `status` | `unconfirmed`、`decided`、`needs_recheck`、`superseded` |
| `doc` | `update`（客戶更新）、`handoff`（交接摘要） |
| `verdict` | `followed`、`violated`、`asked` |

前半提供給後半的函式（在 `src/db.js`）：

- `listDecisions()`：回傳所有決定與目前狀態
- `listMessages()`：回傳所有訊息
- `saveOutput(row)`：存一筆產出與查核

後半提供給前半的函式（在 `src/draft.js`）：

- `buildContext({ decisions, doc, withStick })`（`src/context.js`）：回傳脈絡包 `{ mustFollow, unconfirmed, needsRecheck, excluded, tokens, hash }`
- `judge({ output, packet, facts })`（`src/audit.js`）：回傳 `{ verdict, violations, trace }`
- `draft({ doc, requestedBy, withStick })`（`src/draft.js`）：串起上面兩個，回傳 `{ text, citedDecisions, usedFactIds, verdict, question }`。機器人收到 `!draft update` 或 `!draft handoff` 就呼叫它。

前半另外提供（`src/authority.js`）：

- `decide({ role, channel, action })`：回傳 `{ status }` 或 `null`（沒有權限，不改狀態）

模型：挑出決定用 `claude-haiku-5-5`，寫文件用 `claude-sonnet-5-5`。金鑰各自放自己電腦的 `.env`，**不進 repo**。

## 進度

### 地基
- [x] repo `c0mpiled-18/stick` 建立（19:21）
- [x] Discord 機器人：token 有效、讀訊息內容的開關已開、已在伺服器（18:39 驗過）
- [x] 文件推上 `docs/`（19:37）
- [ ] 隊友接受邀請、抓下 repo、跑 `./.collab/setup.sh`
- [ ] `package.json`、`.gitignore`、`.env.example`（Felix）

### 前半（Felix）
- [ ] `src/db.js`：四張表與上面三個函式
- [ ] `src/bot.js`：連線，在討論頻道打一句，終端機印出作者、頻道、連結
- [ ] 訊息入庫
- [ ] `src/authority.js`：權限規則，七種情況各測一次
- [ ] `src/extract.js`：模型挑出決定，非逐字片段丟掉
- [ ] ✅ 反應只認主管
- [ ] `!draft`、`!flag` 指令接到後半

### 後半（隊友）
- [ ] `scripts/seed.js`：假的決定表
- [ ] `src/context.js`：組脈絡包（必須照做、未確認不可承諾、待重查、排除清單、token 數、指紋）
- [ ] `src/draft.js`：寫客戶更新與交接摘要
- [ ] `src/audit.js`：程式判定有沒有亂承諾
- [ ] `src/server.js` 與網頁：帳本、決定板、文件、查核列，每秒更新
- [ ] `scripts/compliance.js`：有無 Stick 各 5 次，印出結果

### 一起
- [ ] 20:50 兩半接通
- [ ] 待重查 → 停下來問 → 新決定取代舊決定
- [ ] 錄影（2 分鐘內）
- [ ] README（英文）
- [ ] repo 改公開、交件、用無痕視窗確認打得開

## 來不及時先放掉什麼

由下往上放，最上面的最後才放：

1. Discord 講話 → 決定表（誰講的才算數）
2. 打得開的脈絡包
3. 有無 Stick 各 5 次的數字
4. 情況變了，agent 停下來問
5. 新決定取代舊決定、文件第 3 版
6. 拿掉一條規則重跑（已預設不做）

**20:50 接不通的話**：第 4、5 項直接放掉，全部時間拿來接通第 1 到 3 項。

## 規則

- 18:45 之前沒有任何作品程式，這是主辦的規定，不要從別的地方貼舊程式進來。
- 金鑰與 token 不進 repo。
- 各自在自己的分支寫，20:50 合併一次。
- 同一個問題修兩次不過，停下來在這一頁寫下卡在哪。
- `.collab/` 是開發工具，不是作品。

## 還沒確定的事

| 事情 | 誰來確認 | 什麼時候 |
|---|---|---|
| 機器人實際連線後讀不讀得到兩個頻道 | Felix | 19:55 前 |
| 沒有 Stick 時，agent 真的會把猜測寫成承諾嗎 | 後半 | `draft.js` 一做好就跑 |
| 隊友負責後半，還是只做網頁與腳本 | 兩人當面講 | 現在 |
| 影片裡四個發言者，哪幾個是真人帳號 | 兩人當面講 | 21:15 前 |

## 卡住

（寫：幾點、誰、卡在哪、試過什麼）
