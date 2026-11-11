# Stick

> Plug-and-use shared memory for teams of people and agents.
> Built at c0mpiled-18, 2026-11-11, 18:45–22:45. 開發中，交件前這一頁會換成英文的作品說明。

工程頻道剛討論出延期與資安事件，公關專員不知道，新聞稿寫得跟現況衝突。Stick 讀團隊的 Slack／Discord，把對話整理成帶敏感等級的脈絡；專員交稿時，公關主管的審稿 agent 用主管的權限比對最新討論，指出要改哪裡、依據是哪一句話，給專員的版本會遮蔽他無權看的內容。新討論進來，已過審的稿子會自動重審。

## 先看這三份

| 檔案 | 看什麼 |
|---|---|
| [`docs/STATUS.md`](docs/STATUS.md) | **進度正本**：分工、時間表、資料格式、勾選清單 |
| [`docs/build-plan.md`](docs/build-plan.md) | 影片六鏡、每一步怎麼算做完、旁白、評審問答 |
| [`docs/intent-map.md`](docs/intent-map.md) | 為什麼做、架構圖 |

## 加入（三步）

1. 接受 `c0mpiled-18` 的 GitHub 邀請。
2. `gh api user --jq .login` 確認是接受邀請的那個帳號。
3. `gh repo clone c0mpiled-18/stick && cd stick && ./.collab/setup.sh`，然後在這個資料夾執行 `claude`。

跑 `setup.sh` 前先看一眼它與 `.claude/settings.json`：它會在你的電腦裝 hook。開發工具的完整說明在 [`docs/hackathon-kit.md`](docs/hackathon-kit.md)。

## 合作規則

### 1. 進度只有一個正本
- `docs/STATUS.md` 是唯一的進度表。做完一項就勾起來、寫上時間、推上去。
- 想知道隊友做到哪，問自己的 agent（它會跑 `collab team`），或直接看 STATUS。

### 2. 各自的分支、各自的檔案
- Felix：`feat/memory`。antonshuo：`feat/control`。ryan：`feat/web`。各自負責哪些檔案寫在 STATUS 的分工表（新場景版待 Felix 更新）。
- **不改別人的檔案。** 需要對方改，就用 `collab ask` 開一張請求，或當面講。
- **21:00 合併一次**，之前不互相合。合併後小步推到 `main`。
- 只有 `docs/` 可以直接推 `main`。

### 3. 交界講定就不改
- 五張表的欄位與三段互相呼叫的函式寫在 STATUS 的「交界」。
- 20:10 之後要改交界，先當面講好，再用 `collab decide` 記成一張決策，三個人同時改。

### 4. 當面講定的事要記下來
- 當面討論完，叫自己的 agent 記成決策：`.collab/bin/collab decide "標題" <<< "內容"`
- 沒記下來的決定，另一個人的 agent 不會知道。這正是我們在做的產品要解決的問題。

### 5. 金鑰不進 repo
- 模型金鑰與 Discord token 只放自己電腦的 `.env`。`.env` 已列在 `.gitignore`。
- 不在 Discord、issue、commit 訊息裡貼金鑰。貼錯了立刻講，馬上重發一組。

### 6. 每一步先定「怎麼算做完」
- 動手前先寫下這一步的驗收方式（STATUS 與 build-plan 都有）。跑過才算完成。
- 測試有紅的不合併。

### 7. 卡住就講
- 同一個問題修兩次不過，停手，在 STATUS 的「卡住」寫下卡在哪、試過什麼。
- 超過 10 分鐘沒進展就找對方，不要自己悶著修。

### 8. 主辦的規定
- 作品程式全部在今晚 18:45 之後寫。不要從舊專案貼程式進來。
- `.collab/`、`.claude/`、`organizer/` 是開發工具，不是作品。
- demo 裡的公司與人物都是虛構的，不放任何真實公司的資料。

### 9. 21:45 功能凍結
- 之後只修會讓 demo 壞掉的問題，不加新功能。
- 來不及時先放掉什麼，順序寫在 STATUS。

## 常用指令

```
.collab/bin/collab team                         # 每個人的狀態與最新 commit
.collab/bin/collab status <<< "現在在做什麼"      # 更新自己的狀態
.collab/bin/collab ask <帳號> "標題" <<< "內容"   # 請隊友幫忙
.collab/bin/collab decide "標題" <<< "內容"       # 記下一個共同決定
```
