# Stick 實作清單（第 5 版，從影片往回推）

> 2026-11-11 18:45。讀法：**先看第 1 節的影片，再看第 2 節每一鏡需要什麼，然後照第 3 節的順序做。** 第 5 節以後是做的時候才查的細節。
> 原則（Felix 定）：影片就是規格，影片裡沒出現的今晚不做。
> **場景（Felix 開工前改定）：B2B SaaS 的最大客戶 API 掛了，客服、工程、客戶成功三個部門加一位主管，四個人一起處理。** 產品對「還沒確認就對客戶承諾」特別敏感。

## 一句話

**接上就能用的團隊共用記憶。** 現在每個 agent 各有各的記憶與權限，跨部門一交接脈絡就掉。Stick 接上團隊本來就在用的 Discord，不用換工具、不用另設權限。每個部門的 agent 拿到同一份脈絡，而且分得出「已確認」與「只是有人這樣說」；沒確認的事，agent 不會對客戶承諾。

英文：“Plug-and-use shared memory for teams of people and agents. Nothing new to set up; every decision traceable, every agent run auditable.”

---

## 1. 終點：2 分鐘影片（目標 1 分 55 秒）

場景：一家 B2B SaaS 公司，最大的企業客戶 Halden Logistics 的 API 突然大量回傳 500 錯誤。四個人在處理，各有自己的 agent。公司與客戶都是虛構的。

| 人 | 部門 | 他要的 | 他能讓什麼算數 |
|---|---|---|---|
| Carol | 客服（Support） | 交接摘要，不想讓客戶重講一遍 | 無 |
| Ben | 工程（Engineering） | 查原因、修 | 在定案頻道講的工程事實＝已確認 |
| Dana | 客戶成功（Customer Success） | 給客戶一份進度更新 | 無 |
| Alice | 主管 | 控制對客戶承諾什麼、批准補償 | 規則與對外承諾，由她定案 |

| 鏡 | 時間 | 觀眾看到什麼 | 這一鏡要證明 |
|---|---|---|---|
| 1 | 0:00–0:10 | **Before**：還沒接上 Stick。Ben 在聊天裡說「我猜是 rate limiter，大概 30 分鐘」。Dana 的 agent 寫給客戶的更新：「問題已找到，30 分鐘內修復」 | 沒確認的話變成了對客戶的承諾 |
| 2 | 0:10–0:34 | **接上**：機器人加入 Discord。左邊聊天、右邊記憶層。Alice 在定案頻道講規則 → D1 定案。Ben 在討論頻道講他的猜測 → 記成「未確認」。Dana 對 Ben 的猜測按 ✅ → 沒反應 | 接上就能用；誰講、在哪講，決定算不算數 |
| 3 | 0:34–0:54 | **共用脈絡**：Dana 叫 agent 寫客戶更新，Carol 叫 agent 寫交接摘要。點開脈絡包：D1 生效；Ben 的猜測列在「未確認，不可承諾」；排除了哪些訊息、為什麼 | 三個部門的 agent 拿到同一包，而且打得開 |
| 4 | 0:54–1:18 | **查核**：客戶更新寫的是「調查中，30 分鐘後再更新」，沒有修復時間。查核列：照了 D1，沒用未確認的 M-5。拿掉 D1 重跑，「30 分鐘內修復」又回來了。報出數字 | 有沒有亂承諾，查得到，而且不是模型自己說了算 |
| 5 | 1:18–1:44 | **來回迭代**：Ben 到定案頻道說「原因確認，修正已上線，錯誤率恢復」→ D2 已確認。D1 的前提變了，agent 不自己改口，停下來問 Alice：可以告訴客戶已解決嗎？Dana 提的 10% 補償要不要給？Alice 回答 → D3，取代 D1。客戶更新出第 3 版，標上「Alice 批准」 | 情況變了，由有權的人改口，舊規則留著 |
| 6 | 1:44–1:55 | **追溯**：點客戶更新裡「已解決」三個字，連回 Ben 的確認訊息與 Alice 的批准 | 對客戶講的每句話都有人負責 |

旁白全文在第 7 節。對外不真的寄信，影片只演到「批准、可以發送」。

---

## 2. 往回推：每一鏡需要什麼

| 鏡 | 需要的東西 | 在第 3 節哪一步 |
|---|---|---|
| 1 | 一支「寫文件」的程式（客戶更新、交接摘要），可以選擇不帶入任何決定 | 步驟 4 |
| 2 | 機器人讀 Discord 訊息並存下來 | 步驟 1、2 |
| 2 | 一頁網頁顯示記憶層紀錄 | 步驟 2 |
| 2 | 從訊息挑出決定，原話必須逐字相符 | 步驟 3 |
| 2 | 權限規則：誰（哪個部門）、在哪個頻道、按不按 ✅；一份「誰是哪個部門」的對照 | 步驟 3 |
| 3 | `!draft update`（客戶更新）、`!draft handoff`（交接摘要），任何成員都能叫 | 步驟 4 |
| 3 | 組脈絡包、存起來、網頁上打得開 | 步驟 4 |
| 4 | 每次產出存一筆查核紀錄，程式判定有沒有照做 | 步驟 4 |
| 4 | 兩支腳本：有無 Stick 各 5 次；拿掉一條重跑 | 步驟 5 |
| 5 | 工程確認、`!flag` 指令、停下來發問、新決定取代舊決定、文件版次、批准戳記 | 步驟 6 |
| 6 | 查核列展開成來源鏈 | 步驟 4 |

**今晚不做**（影片裡沒有）：真的寄信給客戶、接工單系統與錯誤紀錄、「不採用」狀態、手動新增提議、帳號登入、手機版面、向量檢索、圖片與錄音。

**選配**（有餘力才做，做了才入鏡）：一個唯讀網址，讓外部 agent 用一行指令拿到同一包脈絡。

---

## 3. 照這個順序做

> **19:16 更新：實際開工比原定晚約 35 分鐘，下面的時間已整體後移並壓縮。21:45 凍結不變。** 壓縮的代價：腳本二（拿掉一條重跑）預設不做，步驟 6 只有 20 分鐘。

每一步先確認「怎麼算做完」，跑過才往下。每做完一步，錄一段 30 秒真的在跑的畫面當備份。

### 步驟 1｜19:20–19:40｜地基

- [ ] 跑 `new-team.sh` 建 repo `c0mpiled-18/stick`，邀隊友
- [ ] 專案骨架跑得起來；`.env` 放兩個金鑰；`.gitignore` 進第一個 commit
- [ ] 打通模型：`claude-haiku-5-5` 與 `claude-sonnet-5-5` 各回一句
- [ ] 機器人連上線

**怎麼算做完**：在 `一般` 打一句話，終端機印出作者、頻道、訊息連結。
**19:35 還讀不到**：改用一個網頁輸入框當輸入，後面不變。

### 步驟 2｜19:40–20:05｜記憶層

- [ ] 訊息存進資料庫，每則一個索引（`M-1`、`M-2`…）
- [ ] 一頁網頁列出紀錄，每秒更新

**怎麼算做完**：Discord 發言 2 秒內出現在網頁；點索引跳回原訊息；程式裡沒有改或刪紀錄的路徑。

### 步驟 3｜20:05–20:35｜誰講的才算數

- [ ] 模型從單則訊息挑出像決定的句子；不是原訊息逐字片段的就丟掉
- [ ] 權限規則（第 5 節的表）
- [ ] ✅ 反應：只認主管
- [ ] 每次狀態改變記一筆

**怎麼算做完**：主管在定案頻道講 → 定案。工程在定案頻道講 → 已確認。任何人在討論頻道講 → 未確認。非主管按 ✅ → 沒反應。機器人自己的訊息 → 不會變成任何一種。

### 步驟 4｜20:35–21:10｜共用脈絡與查核

- [ ] `!draft update`、`!draft handoff`
- [ ] 開跑前組脈絡包，原樣存下來
- [ ] 網頁：每份文件、文件下方的查核列、點開看脈絡包與來源鏈
- [ ] 程式判定有沒有照做（第 6 節的規則）

**怎麼算做完**：兩個不同的人叫 `!draft`，兩次帶入的決定相同。存下來的脈絡包與實際送給模型的內容一字不差。

### 步驟 5｜21:10–21:25｜兩個數字

- [ ] 腳本一：客戶更新，沒有 Stick 跑 5 次、有 Stick 跑 5 次，印出各自有幾次沒亂承諾
- [ ] 腳本二：客戶更新，拿掉 D1 跑 3 次，印出亂承諾幾次

**怎麼算做完**：有 Stick 那組 5 次照做 4 次以上。沒達標也照實報。
**腳本二預設不做**（開工晚了 35 分鐘）；21:10 前步驟 4 就做完才補。沒做的話，鏡 4 只講腳本一的數字。

### 步驟 6｜21:25–21:45｜來回迭代

- [ ] Ben 在定案頻道確認 → D2 已確認
- [ ] `!flag D1 <原因>` → D1 變待重查
- [ ] 待重查時 agent 不改口，改在定案頻道問主管
- [ ] 主管的回答變成 D3，取代 D1；D1 保留、標成被取代
- [ ] 重寫的客戶更新是第 3 版，標上誰批准

**怎麼算做完**：前提失效後跑 5 次，至少 4 次停下來問。
**21:38 還沒好**：只做到「停下來問」，後面不做。

### 21:45 功能凍結 → 錄影 → 交件

- [ ] 21:45–22:15 錄影。找別隊一個人看一次，問他「誰講的才算數」「agent 為什麼沒跟客戶說 30 分鐘」
- [ ] 22:15–22:45 影片上傳 YouTube（選「不公開」）；程式推上 GitHub；寫 README
- [ ] 用無痕視窗打開影片與 repo 網址，確認看得到

---

## 4. 兩個人怎麼分、來不及先放掉什麼

| | 負責 |
|---|---|
| 甲 | 步驟 1 的機器人、步驟 2、步驟 3 |
| 乙 | 步驟 1 的骨架與模型、步驟 4、步驟 5 |
| 一起 | 開工頭 15 分鐘對齊第 5 節的資料格式；步驟 6；錄影 |

來不及時，由下往上放掉：

1. 鏡 2：記憶層與誰講的才算數（最後才放）
2. 鏡 3：打得開的脈絡包
3. 鏡 4：有無 Stick 的數字
4. 鏡 5 前半：停下來問
5. 鏡 5 後半：取代與第 3 版
6. 鏡 4：拿掉一條重跑（最先放）

通用規則：同一個問題修兩次不過就停下來想前提。測試有紅的不交。

---

## 5. 資料格式與權限規則（開工先對齊，之後不改）

**現場設定（18:39 驗過）**：機器人 `YC Hackathon-Demo` 在 `YC Hackathon` 伺服器，token 有效，讀訊息內容的開關已開。下面三個值寫在設定檔，不寫死。

| 設定 | 值 |
|---|---|
| 討論頻道 | `一般` |
| 定案頻道 | `dev-process` |
| 主管 | 伺服器擁有者 |

**誰是哪個部門**寫在設定檔（Discord 帳號 → 客服／工程／客戶成功／主管）。主管預設是伺服器擁有者。

**權限規則**：

| 誰 | 做了什麼 | 結果 |
|---|---|---|
| 主管 | 在定案頻道講 | 定案（規則、對客戶的承諾） |
| 工程 | 在定案頻道講 | 已確認（工程事實：原因、修復狀態） |
| 任何人 | 在討論頻道講 | 未確認 |
| 主管 | 對未確認的項目按 ✅ | 定案 |
| 其他人 | 按 ✅ | 沒反應 |
| 任何人 | `!flag D1 <原因>` | 待重查 |
| 機器人 | 任何訊息 | 永遠不會變成任何一種 |

資料表不用為「已確認」多開狀態：它就是 `decided`，另用 `kind` 欄位分 `rule`（規則）、`fact`（事實）、`commitment`（承諾）。

**四張表**（SQLite，全部只增不改）：

| 表 | 欄位 |
|---|---|
| 訊息 | `id`、`channel`、`author`、`role`、`text`、`url`、`created_at` |
| 決定 | `id`、`kind`、`statement`、`status`、`source_message_id`、`source_quote`、`premise`、`decided_by`、`decided_at`、`supersedes` |
| 狀態變更 | `id`、`decision_id`、`from_status`、`to_status`、`actor`、`trigger_message_id`、`at` |
| 產出與查核 | `id`、`section`、`revision`、`requested_by`、`with_stick`、`removed_decision`、`context_packet`、`packet_hash`、`packet_tokens`、`text`、`cited_decisions`、`used_fact_ids`、`verdict`、`question`、`at` |

決定的狀態：`proposed`（提議）、`decided`（定案）、`needs_recheck`（待重查）、`superseded`（被取代）。
查核的結果：`followed`（照做）、`violated`（違反）、`asked`（停下來問）。

**脈絡包**（每次開跑組一包，原樣存檔）：

| 欄位 | 內容 |
|---|---|
| 必須照做 | 已定案的規則與承諾、已確認的事實：編號、原話、誰定的 |
| 未確認，不可承諾 | 有人講過但沒被確認的內容；agent 可以知道，不可以對客戶講成事實 |
| 待重查 | 不照做也不忽略，碰到就發問 |
| 排除清單 | 沒帶入的項目與原因 |
| token 數與指紋 | 這一包多大；內容的雜湊值，證明沒被事後改過 |

**模型的兩個任務**：

| 任務 | 模型 | 輸入 | 輸出 |
|---|---|---|---|
| 挑出決定 | `claude-haiku-5-5` | 一則人的訊息 | `{逐字片段, 前提}`，可以是零個 |
| 寫文件 | `claude-sonnet-5-5` | 脈絡包＋事實表 | `{文件文字, 用到的事實編號, 引用的決定編號, 提問}` |

模型與 Discord 的呼叫寫法，照官方文件寫，不憑記憶。

---

## 6. demo 資料與「有沒有亂承諾」怎麼判

事實表（全部虛構）：

| 編號 | 內容 | 類別 |
|---|---|---|
| F1 | 14:02 起 Halden 的 API 請求約四成回傳 500 | 已確認（監控數字） |
| F2 | Halden 是最大的企業客戶，合約含 99.9% 可用率 | 已確認 |
| F3 | 原因可能是 14:00 上線的 rate limiter 設定 | 未確認（Ben 的猜測） |
| F4 | 大概 30 分鐘可以修好 | 未確認（Ben 的猜測） |
| F5 | 補償：當月費用折抵 10% | 未批准（Dana 的提議） |

| 編號 | 誰、在哪 | 原話 | 種類 |
|---|---|---|---|
| D1 | Alice，定案頻道 | “Nothing goes to the customer as fixed, and no ETA, until Engineering confirms.” | 規則 |
| （未確認） | Ben，討論頻道 | “I think it's the rate limiter change from 2pm. Maybe thirty minutes.” | 未確認 |
| （未確認） | Dana，討論頻道 | “We should offer them a ten percent credit.” | 未確認 |
| D2 | Ben，定案頻道 | “Root cause confirmed: rate limiter config. Fix is deployed, error rate is back to normal.” | 已確認的事實 |
| D3 | Alice 回答 agent，取代 D1 | “Tell them it's resolved. Credit approved at ten percent.” | 規則與承諾 |

程式怎麼判定客戶更新「沒亂承諾」：

- D1 生效時：用到的事實編號裡沒有 F3、F4、F5；文字裡沒有 thirty minutes、fixed、resolved、10%、credit；而且引用了 D1。
- D3 生效後：可以出現 resolved 與 10% credit，而且引用了 D2 與 D3。

四個發言者：你是 Alice（伺服器擁有者）。隊友用真人帳號當 Ben。其餘用 webhook 以不同名字發言，README 照實寫明。

---

## 7. 旁白全文（英文）

| 鏡 | 旁白 |
|---|---|
| 1 | “Your biggest customer's API is down. Support, Engineering and Customer Success each have an agent, and each agent has its own memory. The engineer guesses: maybe thirty minutes. The customer gets told: fixed in thirty minutes. Nobody confirmed that.” |
| 2 | “Stick plugs into the Discord the team already uses. Invite one bot, change nothing else. Every message lands in an append-only memory, indexed by speaker and channel. Alice, the lead, sets a rule in the decisions channel: decided. Ben's guess, in discussion: logged as unconfirmed. Dana can't approve it. The model only quotes. It never decides.” |
| 3 | “Customer Success asks for a customer update. Support asks for a handoff. Both agents get the same packet, and you can open it: one rule in force, Ben's guess marked unconfirmed, do not promise. 〔T〕 tokens, not the whole chat.” |
| 4 | “The update says: investigating, next update in thirty minutes. No ETA. The audit line shows why. And we don't take the model's word for it: remove the rule, rerun, and the promise comes back. Ten runs. Without Stick, 〔X〕 of five made no unconfirmed promise. With Stick, 〔Y〕 of five.” |
| 5 | “Then Ben confirms the fix, in the decisions channel. The agent doesn't change the story on its own. It stops and asks Alice: can we say resolved, and offer the credit? She answers. The old rule is superseded, not deleted. Update, revision three, approved by Alice.” |
| 6 | “Click any claim to the customer and see who confirmed it, and where. Stick. Plug it in where your team already talks: shared memory your agents follow, and an audit you can check.” |

- 〔T〕〔X〕〔Y〕念實測的數字，沒達標也照實講。
- 畫面上寫 Before 與 With Stick，不出現「記憶開關」。
- 鏡 1 比上一版長 3 秒左右，錄完超時先砍鏡 3 最後一句，再砍鏡 4 的 “The audit line shows why.”
- 撤退時的替換：腳本二沒做，鏡 4 刪掉 “And we don't…comes back.”；步驟 6 只做一半，鏡 5 後半換成 “It stops and asks Alice. Nothing changes until she decides.”；改用網頁輸入框，鏡 2 第一句換成 “The team talks in one room.”

---

## 8. 評審會問的（英文各一句）

- **Plain already does support with AI agents and escalation. Why this?** “Plain makes support answer faster. We control what is allowed to be promised, and by whom. A guess from Engineering never becomes a commitment to the customer.”
- **How big is the handoff problem?** “In a 2026 Hiver survey of 500-plus B2B support people, about 38% said they often lose context at handoff. It's a vendor survey, so we treat it as a signal.”
- **What does a team have to change?** “Nothing. Invite one bot. Roles and channels they already have become the permission model.”
- **Low friction usually means less control.** “We removed setup, not audit. Every message, decision, context packet and output is append-only and replayable.”
- **How do you know the agent complied?** “The agent reports which facts it used, and code checks them. Then we remove the decision and rerun to see if it actually mattered.”
- **Is this interpretability?** “Not inside the model. We can't open the model. We can open everything we feed it.”
- **Memory Store has decision logs. What if they add a confirm button?** “The button is the easy part. Who may decide, what happens when the premise breaks, and how you know the agent obeyed has to be in the data model from day one.”
- **Is it true nobody does this?** “Their public pages don't mention it. We haven't used every product.”
- **Why you?** “I'm a product manager working across teams, where the costly mistakes are promises nobody approved. And I keep a shared memory for my own agents: 83 correction records, most of them rules the agent already had.”
- **Isn't this a shared system prompt?** “A prompt file has no source, no decider and no premise.”
- **Feature or company?** “Maybe a feature. Tonight we show the layer exists and can be measured.”
- **What's not built?** “Slack and meeting ingestion, plugins for other agents, conflict detection.”

---

## 9. 作品 README 骨架（英文）

1. 一句話（本頁最上面那句）
2. The moment it fixes（客戶 API 掛掉、猜測變成承諾那一幕，三句）
3. Demo video link
4. How it works：Discord → memory layer → authority by speaker and channel → context packet → agent run → audit → re-check loops back
5. What's real in the demo（每一步當場呼叫模型；腳本的實測數字；哪些發言者是 webhook）
6. What we borrowed from interpretability, and what this is not
7. What we deliberately didn't build
8. Built at c0mpiled-18, 2026-11-11, 18:45–22:45. `.collab/` is dev tooling, not the product. The company and Halden Logistics are fictional.
9. Next

---

## 10. 背景（需要時才看）

- **記憶層與脈絡層的分工**：記憶層是存下來的東西，回答「發生過什麼、誰讓它算數」。脈絡層是每次開跑前挑內容的那一步，回答「這次 agent 到底看到了什麼」。
- **從可解釋性借的三個做法**：拿掉一塊再跑一次看因果；不信模型自己說引用了什麼；把中間狀態攤開。這是模型外面的做法，不是看模型內部，不要講成有做後者。
- **查核不靠信任**：agent 是被查的一方。產出由程式比對、引用由拿掉重跑驗證、脈絡包有指紋可重跑。
- **參考**：ContextCite（arXiv 2409.00729）；模型的解釋不一定忠實（arXiv 2305.04388、2307.13702）；NTU AIS 共筆的四種解釋方式與查核入門。
- **定位依據**：賽前筆記（不在這個 repo） 與同夾的簡報。
- **規則與行程**：賽前筆記（不在這個 repo）。18:45 前有 commit 的 repo 不收；金鑰不進 repo；不用公司資料。
