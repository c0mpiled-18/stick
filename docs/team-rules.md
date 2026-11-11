# Team rules during the hackathon (Chinese)

> Moved here from the README at submission time. These were our working agreements during the build.

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
