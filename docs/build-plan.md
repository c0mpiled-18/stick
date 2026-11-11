# Stick 實作清單（第 6 版，公關審稿場景，從影片往回推）

> 2026-11-11 19:50 改版。讀法：**先看第 1 節的影片，再看第 2 節每一鏡需要什麼，然後照第 3 節的順序做。** 第 5 節以後是做的時候才查的細節。
> 原則：影片就是規格，影片裡沒出現的今晚不做。
> **場景（19:50 團隊改定）：工程頻道剛討論出延期與資安事件，公關專員不知道，寫了一份與現況衝突的新聞稿；公關主管的審稿 agent 依主管權限比對最新脈絡，在稿子出去前擋下。** 舊場景（客戶 API 當機、誰講的才算數）見 commit `0f85b22`。

## 一句話

**接上就能用的團隊共用記憶，把最新脈絡依職位送到要簽核的人手上。** Stick 自動讀 Slack／Discord 的對話，整理成帶敏感等級的脈絡；公關專員交稿時，主管的審稿 agent 用主管的權限比對最新討論，指出要改哪裡、依據是哪一句話，給下屬的版本會遮蔽他無權看的內容。

英文：“Plug-and-use shared memory for teams of people and agents. The right context reaches the person who signs off, before anything goes out — and never leaks down.”

---

## 1. 終點：2 分鐘影片（目標 1 分 55 秒）

場景：虛構的消費型 App 公司 Kestrel，準備發布新功能 Smart Export 的新聞稿。公司與人物都是虛構的。

| 人 | 職位 | 他要的 | 他看得到 |
|---|---|---|---|
| Erin | 公關專員（`pr_staff`） | 稿子快點過審 | `public`、`internal` |
| Alice | 公關主管（`pr_lead`），Erin 的主管 | 稿子出去前確認沒有跟公司現況衝突 | 全部，含 `restricted` |
| Ben | 工程（`engineering`） | 在工程頻道討論延期與事故 | 全部 |
| Dana | 法務（`legal`） | 控制對外怎麼講資安 | 全部 |

| 鏡 | 時間 | 觀眾看到什麼 | 這一鏡要證明 |
|---|---|---|---|
| 1 | 0:00–0:12 | **Before**：還沒接上 Stick。Erin 的新聞稿寫「Smart Export 明天上線」「我們從未發生資安事件」。她的 agent 審稿：沒問題 | 寫稿的人不知道工程剛發生什麼，agent 也不知道 |
| 2 | 0:12–0:36 | **接上**：機器人加入。左邊聊天、右邊脈絡。Ben 在 `eng-general` 說 Smart Export 延到下週四 → 脈絡，`internal`。Ben 在 `eng-incident` 說匯出 API 外洩了部分使用者 email → `restricted`。Dana 說週五法務審查前不對外談資安 → `restricted`。網頁切成 Erin 看：只有延期那條；切成 Alice 看：三條都在 | 接上就能用；頻道與職位決定誰看得到 |
| 3 | 0:36–1:00 | **審稿**：Erin 在 `pr-drafts` 打 `!review` 交稿。Alice 的審稿 agent 用 Alice 的權限：**先擋下**。兩條問題：上線日期與延期衝突（引用 Ben）；「從未發生資安事件」與事故及法務規定衝突（引用 Ben、Dana）。附修改建議 | 稿子出去前被抓到，而且每條都有依據 |
| 4 | 1:00–1:20 | **遮蔽與數字**：切成 Erin 看同一筆審稿：看得到日期那條；第二條只寫「主管另有一項需要調整，會直接跟你談」。報出數字：有無 Stick 各審 5 次 | 主管用自己的眼睛審，下屬拿到的版本不洩密；差別是量得出來的 |
| 5 | 1:20–1:44 | **重審**：Erin 改成第 2 版（日期改下週四、拿掉資安那句）→ 通過。接著 Ben 在 `eng-general` 說「又要再延一週」→ 第 2 版自動被標成「需重審」，重審結果：要修改，引用 Ben 的新訊息 | 新討論進來，舊稿不會照發 |
| 6 | 1:44–1:55 | **追溯**：點任一條建議，連回原始訊息 | 每條建議都查得到出處 |

旁白全文在第 7 節。不真的發新聞稿，影片只演到「主管批准」。

---

## 2. 往回推：每一鏡需要什麼

| 鏡 | 需要的東西 | 在第 3 節哪一步 |
|---|---|---|
| 1 | 審稿程式可以選擇不帶入任何脈絡（`withStick: false`） | 步驟 4 |
| 2 | 機器人讀兩個工程頻道並存下來 | 步驟 1、2 |
| 2 | 訊息整理成脈絡，標主題與敏感等級；等級取頻道下限與模型判斷的較高者 | 步驟 2 |
| 2 | 讀取口依職位過濾；網頁可以切換身份 | 步驟 3、5 |
| 3 | `!review <稿件>` 指令；審稿用作者主管的權限；結論、問題、建議、引用 | 步驟 4 |
| 3 | 引用的原話逐字比對，不符就丟 | 步驟 4 |
| 4 | 審稿結果依引用等級遮蔽 | 步驟 3、4 |
| 4 | 腳本：有無 Stick 各 5 次 | 步驟 6 |
| 5 | 稿件版次；新脈絡事件 → 找主題相關的稿件 → 重審 | 步驟 7 |
| 6 | 引用連回原訊息網址 | 步驟 5 |

**今晚不做**（影片裡沒有）：真的發新聞稿、Slack 實際接入（只留同一個介面）、帳號登入、手機版面、向量檢索、主動 DM 通知主管、圖片與錄音。

**選配**（有餘力才做，做了才入鏡）：重審時機器人在 `pr-drafts` 標記 Alice。

---

## 3. 照這個順序做

> 現在 19:50，21:45 凍結。三個人照資料流切：A 進來、B 讀取口、C 審稿與網頁。每一步先確認「怎麼算做完」，跑過才往下；每做完一步錄一段 30 秒真的在跑的畫面當備份。

### 步驟 0｜19:50–20:05｜一起：對齊交界

- [ ] 三人一起看第 5 節的表與函式，講定就不改
- [ ] B 推 `src/db.js` 建表、`config/people.json`、`scripts/seed.js`（第 6 節的假資料）
- [ ] A 確認機器人讀得到 `eng-general`、`eng-incident`、`pr-drafts`；開不了新頻道就沿用 `一般`＝`eng-general`、`dev-process`＝`eng-incident`，交稿改網頁輸入框

### 步驟 1｜A｜20:05–20:25｜機器人與訊息入庫

- [ ] 機器人連線，人的訊息存進 `messages`，每則一個索引（`M-1`、`M-2`…）
- [ ] 機器人自己的訊息不入庫

**怎麼算做完**：在 `eng-general` 打一句，2 秒內 `messages` 多一筆，有作者、頻道、原訊息網址。
**20:20 還讀不到**：改用網頁輸入框當輸入，後面不變。

### 步驟 2｜A｜20:25–20:55｜整理成脈絡

- [ ] 每則人的訊息丟給 `claude-haiku-5-5`：輸出 `{summary, topics, sensitivity, quote}`，可以是零條
- [ ] `quote` 不是原訊息逐字片段就丟
- [ ] 等級＝`max(頻道下限, 模型判斷)`
- [ ] 寫入 `context_items`，並寫一筆 `events`（`type = context_added`，帶 `item_id`、`topics`）

**怎麼算做完**：`eng-incident` 的訊息永遠是 `restricted`；`eng-general` 提到資安的訊息被調成 `restricted`；改過字的引用被丟掉。

### 步驟 3｜B｜20:05–20:40｜讀取口與遮蔽

- [ ] `retrieveContext(viewer, { topics })`：只回傳 viewer 看得到的脈絡，另回傳被排除的數量
- [ ] `getManager(user)`、`clearanceOf(user)`
- [ ] `redactReviewFor(viewer, review)`：問題的等級高於 viewer 的，換成「主管另有一項需要調整，會直接跟你談」
- [ ] 測試：每個職位 × 每個等級；限閱原話不出現在 Erin 的任何回傳

**怎麼算做完**：測試全綠；Erin 拿到 1 條、Alice 拿到 3 條（用 seed 資料）。

### 步驟 4｜C｜20:05–20:50｜審稿

- [ ] `reviewDraft({ draftId, trigger, withStick })`：找作者的主管 → `retrieveContext(主管)` → 組脈絡包並存檔 → `claude-sonnet-5-5` 輸出 JSON
- [ ] 每條問題的引用逐字比對，不符就丟；每條問題的等級＝它引用的脈絡的最高等級
- [ ] 結論：`ok`、`needs_change`、`block`
- [ ] 先用 seed 資料開發，不等 A

**怎麼算做完**：用 seed 的稿子跑，兩個衝突都抓到、引用正確；`withStick: false` 時脈絡包是空的。

### 步驟 5｜C｜20:50–21:05｜網頁

- [ ] 上方切換身份（Erin／Alice／Ben）
- [ ] 左：脈絡（依身份過濾）；右：稿件與審稿結果（依身份遮蔽）
- [ ] 點引用跳回原訊息；每秒更新

**怎麼算做完**：切成 Erin，畫面上找不到任何限閱原話。

### 步驟 6｜B｜20:40–21:05｜數字與 demo 資料

- [ ] `scripts/compare.js`：同一份稿子，有無 Stick 各審 5 次，印出兩個衝突都抓到的次數
- [ ] `scripts/leak-check.js`：掃 Erin 視角的所有回傳，限閱原話出現次數必須是 0
- [ ] 第 6 節的 demo 對話備好（webhook 發言腳本）

### 21:00｜一起：接通

- [ ] 合併三個分支，從 Discord 講話一路走到網頁出現審稿結果

### 步驟 7｜A＋C｜21:15–21:40｜重審

- [ ] C 的 `onContextAdded(event)`：找主題重疊、最新結論為 `ok` 或 `needs_change` 的稿件，以 `trigger = context_added` 重審
- [ ] A 在寫完脈絡後呼叫它（或 C 每 5 秒輪詢 `events`）
- [ ] 網頁上被重審的稿件標「需重審 → 新結論」

**怎麼算做完**：第 2 版過審後，Ben 說再延一週，5 次至少 4 次第 2 版被改判為 `needs_change` 並引用新訊息。
**21:38 還沒好**：只做到「標記需重審」，不重跑。

### 21:45 功能凍結 → 錄影 → 交件

- [ ] 21:45–22:15 錄影。找別隊一個人看一次，問他「為什麼 Erin 看不到第二條」「agent 怎麼知道延期」
- [ ] 22:15–22:45 影片上傳 YouTube（選「不公開」）；程式推上 GitHub；寫 README
- [ ] 用無痕視窗打開影片與 repo 網址，確認看得到

---

## 4. 三個人怎麼分、來不及先放掉什麼

| | 負責 | 分支 |
|---|---|---|
| A | 機器人、訊息入庫、整理成脈絡、發事件 | `feat/ingest` |
| B | 資料庫、讀取口、遮蔽、seed 與 demo 資料、兩支腳本、旁白與 README 初稿 | `feat/access` |
| C | 審稿、網頁、重審 | `feat/agent` |
| 一起 | 開工 15 分鐘對齊第 5 節；21:05 接通；步驟 7；錄影 | |

誰負責哪一段，以 `docs/STATUS.md` 的分工為準（Felix 依新場景更新）。

來不及時，由下往上放掉：

1. 鏡 2、3：脈絡依職位過濾＋審稿抓到衝突（最後才放）
2. 鏡 4：遮蔽版
3. 鏡 6：點引用跳回原訊息
4. 鏡 4：有無 Stick 的數字
5. 鏡 5：重審（先放掉重跑，只留標記）
6. 選配：重審時標記 Alice（最先放）

通用規則：同一個問題修兩次不過就停下來想前提。測試有紅的不交。

---

## 5. 資料格式與權限規則（開工先對齊，之後不改）

**現場設定（18:39 驗過）**：機器人 `YC Hackathon-Demo` 在 `YC Hackathon` 伺服器，token 有效，讀訊息內容的開關已開。下面的值寫在設定檔，不寫死。

`config/channels.json`（A）：

| 頻道 | 用途 | 敏感等級下限 |
|---|---|---|
| `eng-general` | 工程日常討論 | `internal` |
| `eng-incident` | 事故與資安 | `restricted` |
| `pr-drafts` | 公關交稿（`!review`） | 不入脈絡 |

`config/people.json`（B）：Discord 帳號 → `{ name, role, manager }`。

| 職位 `role` | 看得到 |
|---|---|
| `pr_staff` | `public`、`internal` |
| `pr_lead` | 全部 |
| `engineering` | 全部 |
| `legal` | 全部 |
| `bot` | 不入庫 |

**權限規則**：

| 情況 | 結果 |
|---|---|
| 訊息來自某頻道 | 脈絡等級至少是該頻道下限 |
| 模型判斷較敏感 | 往上調；模型判斷較不敏感時不理會 |
| 任何地方要拿脈絡 | 只能呼叫 `retrieveContext(viewer)` |
| 審稿 | 用稿件作者的主管當 viewer |
| 審稿結果給某人看 | 先過 `redactReviewFor(viewer, review)` |

**表**（SQLite 一個檔 `stick.db`，全部只增不改）：

| 表 | 欄位 |
|---|---|
| `messages` | `id`、`source`（`discord`／`slack`）、`channel`、`author`、`role`、`text`、`url`、`created_at` |
| `context_items` | `id`、`summary`、`topics`（JSON）、`sensitivity`、`source_message_id`、`source_quote`、`created_at` |
| `drafts` | `id`、`author`、`title`、`text`、`revision`、`parent_id`、`created_at` |
| `reviews` | `id`、`draft_id`、`reviewer`、`trigger`（`submitted`／`context_added`）、`with_stick`、`context_packet`、`packet_hash`、`verdict`、`issues`（JSON）、`at` |
| `events` | `id`、`type`（`context_added`）、`payload`（JSON）、`at` |

`issues` 每一條：`{ text, suggestion, cited_item_ids, sensitivity }`。
結論 `verdict`：`ok`（可以）、`needs_change`（要修改）、`block`（先擋下）。

**函式交界**：

| 檔案（誰） | 函式 | 回傳 |
|---|---|---|
| `src/db.js`（B） | `insertMessage`、`insertContextItem`、`insertDraft`、`insertReview`、`insertEvent` | 新的 id |
| `src/db.js`（B） | `listDrafts()`、`latestReview(draftId)`、`listEvents(sinceId)` | 列 |
| `src/access.js`（B） | `retrieveContext(viewer, { topics })` | `{ items, excludedCount }` |
| `src/access.js`（B） | `getManager(user)`、`clearanceOf(user)`、`redactReviewFor(viewer, review)` | |
| `src/ingest.js`（A） | `ingestMessage(msg)` | 新增的脈絡 id 陣列 |
| `src/review.js`（C） | `reviewDraft({ draftId, trigger, withStick })` | 審稿列 |
| `src/review.js`（C） | `onContextAdded(event)` | 重審的稿件 id 陣列 |

**脈絡包**（每次審稿組一包，原樣存檔）：

| 欄位 | 內容 |
|---|---|
| 審稿身份 | 用誰的權限（主管） |
| 脈絡 | 看得到的脈絡：編號、摘要、原話、等級、出處 |
| 排除數量 | 因權限沒帶入的條數（不列內容） |
| 指紋 | 內容的雜湊值，證明沒被事後改過 |

**模型的兩個任務**：

| 任務 | 模型 | 輸入 | 輸出 |
|---|---|---|---|
| 整理成脈絡 | `claude-haiku-5-5` | 一則人的訊息與頻道 | `{summary, topics, sensitivity, quote}` 陣列，可以是零個 |
| 審稿 | `claude-sonnet-5-5` | 脈絡包＋稿件 | `{verdict, issues: [{text, suggestion, cited_item_ids, quote}]}` |

模型與 Discord 的呼叫寫法，照官方文件寫，不憑記憶。

---

## 6. demo 資料與「有沒有抓到」怎麼判

對話（全部虛構，英文以便評審看）：

| 編號 | 誰、在哪 | 原話 | 等級 | 主題 |
|---|---|---|---|---|
| C1 | Ben，`eng-general` | “Heads up: Smart Export slips to next Thursday. QA found a sync bug.” | `internal` | `launch` |
| C2 | Ben，`eng-incident` | “The export API exposed some users' email addresses for about two hours yesterday. Patched this morning.” | `restricted` | `security` |
| C3 | Dana，`eng-incident` | “No public statements about security or data safety until legal review on Friday.” | `restricted` | `security`、`comms` |
| C4（鏡 5 才發） | Ben，`eng-general` | “Bad news: Smart Export slips another week.” | `internal` | `launch` |

稿件：

| 版 | 作者 | 內容 |
|---|---|---|
| v1 | Erin | “Kestrel launches Smart Export tomorrow. Your data has always been safe with us — we have never had a security incident.” |
| v2 | Erin | “Kestrel launches Smart Export next Thursday, making it easier to take your notes anywhere.” |

程式怎麼判定「抓到」：

- v1（C1–C3 存在時）：`verdict` 不是 `ok`；一條問題引用 C1；一條問題引用 C2 或 C3。
- v2（C1–C3 存在時）：`verdict` 是 `ok`。
- v2（C4 發出後重審）：`verdict` 是 `needs_change`，引用 C4。
- 遮蔽：Erin 視角的 v1 審稿結果，看得到引用 C1 的那條；引用 C2、C3 的那條被換成固定文字；C2、C3 的原話在 Erin 的任何回傳中出現 0 次。

四個發言者：Alice 是伺服器擁有者。隊友用真人帳號當 Ben 與 Erin。Dana 用 webhook 發言，README 照實寫明。

---

## 7. 旁白全文（英文）

| 鏡 | 旁白 |
|---|---|
| 1 | “Erin writes the launch press release. Smart Export ships tomorrow, and we've never had a security incident. Her agent says it looks great. Neither of them knows what Engineering talked about last night.” |
| 2 | “Stick plugs into the Slack or Discord the team already uses. Every message becomes context, tagged by topic and sensitivity. The incident channel is restricted by default, and the model can only raise a level, never lower it. Erin sees one item. Alice, her lead, sees all three.” |
| 3 | “Erin submits the draft. Stick reviews it through Alice's eyes: blocked. The launch date conflicts with Ben's update. The security claim conflicts with the incident, and with Legal's rule. Every issue quotes its source.” |
| 4 | “Erin gets the same review, filtered: fix the date, and talk to Alice about the rest. Nothing restricted leaks down. Five runs each: without Stick, 〔X〕 of five caught both issues. With Stick, 〔Y〕 of five.” |
| 5 | “Erin fixes it. Approved. Then Engineering slips the launch again. Stick re-reviews the approved draft on its own, and flags it before it goes out.” |
| 6 | “Click any issue and see the message behind it. Stick: the right context reaches the person who signs off, before anything goes out.” |

- 〔X〕〔Y〕念實測的數字，沒達標也照實講。
- 畫面上寫 Before 與 With Stick。
- 超時先砍鏡 2 最後一句，再砍鏡 6 第一句。
- 撤退時的替換：遮蔽沒做，鏡 4 前兩句換成 “Restricted context stays with the lead.”；重審只做到標記，鏡 5 後半換成 “Stick flags the approved draft for re-review.”；改用網頁輸入框，鏡 2 第一句換成 “The team talks in one room.”

---

## 8. 評審會問的（英文各一句）

- **Isn't this just enterprise search over Slack, like Glean?** “Search answers whoever asks, with what they can see. We push the right context to the person who has to sign off, at the moment something is about to go out.”
- **Why permissions?** “The person who writes the draft often isn't allowed to know why it's wrong. The lead is. So the review runs with the lead's access, and the writer gets a filtered version.”
- **Can the model leak restricted info?** “Every read goes through one function that filters by role, the model can only raise sensitivity, and a script checks the writer's view for any restricted quote. Tonight: zero.”
- **What does a team have to change?** “Nothing. Invite one bot. Channels set the sensitivity floor, and roles map from accounts.”
- **How do you know the review is grounded?** “Every issue must quote a stored message word for word, or we drop it. And we rerun without Stick to show the difference.”
- **Why Discord, not Slack?** “Same interface. Tonight we wired Discord because the bot was verified; Slack is one adapter away.”
- **Feature or company?** “Maybe a feature. Tonight we show the layer exists and can be measured.”
- **What's not built?** “Slack ingestion, real login, notifying the lead directly, smarter topic matching.”

---

## 9. 作品 README 骨架（英文）

1. 一句話（本頁最上面那句）
2. The moment it fixes（新聞稿與工程現況衝突、寫稿的人不能知道原因那一幕，三句）
3. Demo video link
4. How it works：Slack/Discord → messages → context with sensitivity → one read path filtered by role → review with the lead's access → filtered result for the writer → re-review when new context arrives
5. What's real in the demo（每一步當場呼叫模型；腳本的實測數字；哪些發言者是 webhook）
6. What we deliberately didn't build
7. Built at c0mpiled-18, 2026-11-11, 18:45–22:45. `.collab/` is dev tooling, not the product. Kestrel and everyone in the demo are fictional.
8. Next

---

## 10. 背景（需要時才看）

- **三層的分工**：脈絡層回答「發生過什麼、誰講的」；權限層回答「誰看得到」；審稿層回答「這份稿子跟現況有沒有衝突、要改什麼」。
- **為什麼審稿用主管的權限**：寫稿的人常常無權知道稿子為什麼不行；能判斷的是要簽核的人。結果再依下屬權限遮蔽，主管決定要不要當面說明。
- **查核不靠信任**：引用由程式逐字比對、洩露由腳本掃描、差別由有無 Stick 對照證明。
- **規則與行程**：18:45 前有 commit 的 repo 不收；金鑰不進 repo；不用公司資料。
