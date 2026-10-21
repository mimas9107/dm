---
name: "TASK.md"
description: "來電送 CALL & DELIVER — 前端 B 組 Monolithic Script 重構執行任務"
created_date: "2026/10/21"
modified_date: "2026/10/22"
project_version: "1.0.0"
document_version: "1.0.1"
agent_sign: ['human/justin', 'claude/claude-sonnet-4-6']
---

# 重構執行任務表 (TASK.md)

> 設計依據見 [PLAN.md](./PLAN.md)。本檔記錄**執行步驟、順序與進度**。
> 狀態圖例：`[ ]` 未開始　`[~]` 進行中　`[x]` 已完成

---

## 任務總覽

| # | 任務 | 對應 PLAN 問題 | 狀態 |
|---|---|---|---|
| T0 | 基礎建設：目錄結構、`serve.sh`、README、CHANGELOG | §3 | `[x]` |
| T1 | CSS 拆分：`base.css` + `css/pages/*.css` | P2 | `[x]` |
| T2 | Tailwind 主題設定外移 + `file://` 守衛 | P2 / §6.1 §6.2 | `[x]` |
| T3 | `js/core/seed-data.js` — 種子資料單一真相來源 | P1 | `[x]` |
| T4 | `js/core/store.js` — 共用狀態庫單一真相來源（修正 P1 資料遺失） | P1 | `[x]` |
| T5 | `js/core/dom.js` + `js/core/toast.js` — 共用工具 | P2 | `[x]` |
| T6 | `js/pages/index.js` — 顧客首頁 | P2 P3 | `[x]` |
| T7 | `js/pages/order-accept.js` — 店家接單頁 | P2 P3 | `[x]` |
| T8 | `js/pages/user-order-track.js` — 顧客追蹤頁 | P2 P3 | `[x]` |
| T9 | `js/pages/controller.js` — 主控台 | P2 P3 | `[x]` |
| T10 | inline `onclick` → 事件委派全數改造 | P3 | `[x]` |
| T11 | `tests/smoke.mjs` 回歸測試 + 全流程驗證 | P4 | `[x]` |
| T12 | 文件同步（README / CHANGELOG / 版本號） | P4 | `[x]` |

> **執行順序原則**：T0 → T1/T2 → T3 → T4 → T5 → T6~T9 → T10 → T11 → T12。
> T3~T5 完成後，四個頁面的 JS 才有可 import 的共用基礎，**不可跳過**。

---

## T0 — 基礎建設

**目標**：建立新目錄骨架與開發流程工具，讓後續每個任務都有可驗收的落點。

- [x] 建立 `assets/`、`css/pages/`、`js/core/`、`js/pages/`、`tests/` 目錄
- [x] `git mv CoDeliver-logo-1020x1020px-20261021.svg assets/`（保留 git 歷史）
- [x] 建立 `serve.sh`：一鍵啟動 `python3 -m http.server 8080`
      - 檢查 `python3` 存在 → 啟動 → 印出 `http://localhost:8080/`
      - `chmod +x serve.sh`
- [x] 建立 `README.md`（含 YAML 標頭、`project_version`、啟動說明、專案結構）
- [x] 建立 `CHANGELOG.md`（版本單一事實來源，基準版本 `1.0.0`）

**驗收**：`./serve.sh` 可啟動並在瀏覽器開啟首頁；`README.md` 說明清楚「勿雙擊開啟」。

---

## T1 — CSS 拆分

**目標**：CSS 依職責分離為「全站共用」+「各頁專屬」。

- [x] 建立 `css/base.css`
      - 承接 4 個 HTML 重複的 `body` 樣式（`#F8F6F4` 背景、Noto Sans TC、tap-highlight）
      - 集中放置 `:focus-visible` 等共用 a11y 樣式
- [x] 建立 `css/pages/index.css` → `.out-of-range-mask`（外送範圍斜線遮罩）
- [x] 建立 `css/pages/order-accept.css` → `.incoming-order-banner`（斜線紋理背景）
- [x] 建立 `css/pages/user-order-track.css`、`css/pages/controller.css`（現況無專屬樣式，保留擴充位與說明註解）
- [x] 4 個 HTML 移除 inline `<style>` 區塊，改以 `<link rel="stylesheet" href="./css/base.css">` 引入
      - `base.css` 之後再引入該頁的 `page-*.css`
      - **載入順序**：`<link>` 必須在 Tailwind CDN script 之後（PLAN §6.3）

**驗收**：`grep -c '<style' *.html` 全部為 0；四頁視覺與重構前一致（截圖比對）。

---

## T2 — Tailwind 主題設定外移 + `file://` 守衛

- [x] 建立 `js/core/tailwind-config.js`（**傳統 classic script，非 module**）
      - 內容為現況 4 份 inline `tailwind.config` 的唯一版本
      - 檔頭註解說明「為何不可改為 module」（PLAN §6.1）
- [x] 建立 `js/core/file-protocol-guard.js`（**傳統 classic script**）
      - 偵測 `location.protocol === 'file:'` → 顯示明確指引畫面（含 `./serve.sh` 指令）
      - 非 `file:` 時不做任何事
- [x] 4 個 HTML `<head>` 改為：
      ```html
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="./js/core/tailwind-config.js"></script>
      <script src="./js/core/file-protocol-guard.js"></script>
      ```

**驗收**：`grep -c 'tailwind.config' *.html` 全部為 0；
以 `file://` 開啟任一頁會看到明確指引而非白畫面；`brick` 主題色正常呈現。

---

## T3 — `js/core/seed-data.js`（種子資料單一真相來源）

**目標**：消除 4 份重複的預設資料。

- [x] 匯出 `restaurants`（首頁 3 家餐廳 + 菜單 `menu`）— 取自 `index.html` 的 `baseRestaurantsData`
- [x] 匯出 `stores`（後台店家設定：id/name/soundAlert/soundEnabled/hours/minOrder/minQty/active）
- [x] 匯出 `customers`（id/name/tel/orders/abandonedCount/blacklisted）
- [x] 匯出 `orders`（orderId/storeId/storeName/deliverBy/address/customerName/customerPhone/accepted/step/items）
- [x] 匯出 `cmsDocs`（key/shortLabel/fullTitle/updatedAt/content）
- [x] 匯出 `createDefaultState()` → `{ version, activeOrderId, stores, customers, orders, cmsDocs }`
- [x] **資料比對**：以 `diff` 確認 4 份原檔的資料內容完全一致後才刪除原檔

**驗收**：`grep -rn '禾風堂手作便當' js/ | wc -l` 的命中只在 `seed-data.js`；
4 個 HTML 內不再出現任何種子資料。

---

## T4 — `js/core/store.js`（共用狀態庫單一真相來源）★ 關鍵任務

**目標**：消除 P1 資料遺失風險。

- [x] `export const STORAGE_KEY = 'laidiansong_shared_state_v1'`
- [x] `export const STATE_VERSION = 2`
- [x] `loadState()` **改寫為逐欄位補齊**（**絕不整份重置**）：
      1. 讀 `localStorage`；壞掉 → 退回種子資料
      2. 缺 `stores` / `customers` / `orders` / `cmsDocs` → **各自**補種子值
      3. 缺 `activeOrderId` → 補第一筆訂單的 `orderId`
      4. `version` 舊於 `STATE_VERSION` → 執行遷移函式
      5. **訂單與顧客資料在任何情況下都不得被清空**
- [x] `saveState(state)` / `getState()` / `updateState(fn)` / `resetState()`
- [x] `subscribe(fn)`：封裝 `window.addEventListener('storage', ...)`，
      **僅在 `e.key === STORAGE_KEY` 時觸發**，回傳 unsubscribe 函式
- [x] 移除 4 個 HTML 內的 `SHARED_STORAGE_KEY` / `getDefaultSharedState` / `loadSharedState` / `saveSharedState`

**驗收**：
- `grep -rn 'SHARED_STORAGE_KEY\|getDefaultSharedState\|loadSharedState\|saveSharedState' .` 只在 `js/core/store.js` 命中
- **單元測試**：寫入一份「缺 `cmsDocs` 但有 `orders`」的狀態 → `loadState()` 後 `orders` 長度不變、`cmsDocs` 補上

---

## T5 — `js/core/dom.js` + `js/core/toast.js`

- [x] `js/core/dom.js`
      - `$` / `$$` 糖
      - `refreshIcons()`：安全呼叫 `window.lucide?.createIcons()`
      - `formatDeliverBy(t)`：`'12:15'` → `'12:15 前送到'`
      - `formatMoney(n)`：`1234` → `'NT$ 1,234'`
- [x] `js/core/toast.js`
      - `showToast(message, { variant })`（`info` / `success` / `warning`）
      - 合併現況兩份重複實作（`index.showToastWarning` 置頂置中、`controller.showToast` 置右下）
      - 保留原本的出現位置與消失動畫語意

**驗收**：兩頁的提示訊息皆由 `core/toast.js` 提供，頁面檔內不再有各自的 toast 實作。

---

## T6 — `js/pages/index.js`（顧客首頁）

- [x] 由 `index.html` 的 inline script 搬移全部邏輯，import T3~T5 的共用模組
- [x] 狀態：`currentSlide` / `carouselTimer` / `currentRestaurant` / `cart` / `isOutOfRange` / `selectedCustomerId`
- [x] 保留行為：`?store=<id>` 網址參數、`updateCarousel` 指示條連動、起送門檻 UI、停權 UI、黑名單阻擋
- [x] `submitOrderAndGoTrack()` 改用 `updateState()` 寫入訂單並更新 `customers[].orders` / `activeOrderId`
- [x] 訂單編號規則維持 `#${100 + storeId}`（`#101` / `#102` / `#103`）
- [x] `DOMContentLoaded` 初始化（取代 `window.onload`）

**驗收**：首頁 4 個 view（首頁 / 店家詳情 / 撥號 modal / CMS modal）行為與重構前一致。

---

## T7 — `js/pages/order-accept.js`（店家接單頁）

- [x] 搬移全部邏輯
- [x] 保留 Web Audio 行為：
      - `scheduleChimeNotes()` 六音叮咚和弦（E5 / G5 / C6 × 2）含 triangle 泛音
      - `playIncomingOrderChime()` 處理 `AudioContext` suspended 狀態
      - `syncOrderAlertSound()` / `stopOrderAlertSound()` 4.5 秒迴圈響鈴
      - **音效僅在該訂單所屬店家 `soundEnabled` 為 true 時播放**
- [x] 保留瀏覽器音訊解鎖（pointerdown / touchstart / mousedown / keydown 首次手勢後 `resume()`）
- [x] `acceptOrder()` / `updateOrderStepFromStore(stepIdx)` 改用 `updateState()`

**驗收**：待接單時響鈴、接單後靜音；主控台關閉某店家音效後該店訂單不再響鈴。

---

## T8 — `js/pages/user-order-track.js`（顧客追蹤頁）

- [x] 搬移全部邏輯
- [x] 保留 `trackStages` 三階段定義（label / etaTitle / getEtaText / getDesc）
- [x] 進度條寬度 0% / 50% / 100%；節點樣式 3 種狀態
- [x] `applyTrackStepUI()` 在 `accepted === false && step === 0` 時顯示「待店家接單確認」
- [x] `setTrackStep()` 寫回共用狀態庫

**驗收**：切換 3 階段時徽章 / 進度條 / ETA 文字同步正確。

---

## T9 — `js/pages/controller.js`（主控台）

- [x] 搬移全部邏輯
- [x] 三大頁籤切換、統計數字、店家表格、顧客表格、CMS 編輯器
- [x] 棄單累計 ≥ 2 自動列入黑名單
- [x] CMS 編輯中（`isEditingCms`）收到跨分頁更新時**不覆蓋**編輯內容
- [x] `jumpToOrder(orderId)` 設定 `activeOrderId` 後跳追蹤頁

**驗收**：主控台三個頁籤功能與重構前一致；修改即時反映到前台。

---

## T10 — inline `onclick` → 事件委派

**目標**：根治 P3，讓「增刪功能」不需要改 HTML 字串。

- [x] 定義統一約定（PLAN §5）：
      ```html
      <button data-action="change-qty" data-item-id="101" data-delta="-1">
      ```
- [x] 每頁一個 `document` 層級 delegated listener，依 `data-action` 分派
- [x] 取代 **48 個** inline handler：
      - `index.html` 23 個（含 template string 內的 `changeQty` / `openCmsInfoModal`）
      - `controller.html` 12 個（含 `recordAbandon` / `toggleStoreSound` / `switchCmsDoc` 等帶參數者）
      - `order_accept.html` 8 個（含 `switchMockOrder` / `updateOrderStepFromStore`）
      - `user_order_track.html` 5 個
- [x] 需帶參數者改用 `data-*`：
      | 舊 inline | 新 data 屬性 |
      |---|---|
      | `changeQty(${item.id}, -1)` | `data-action="change-qty" data-item-id="${item.id}" data-delta="-1"` |
      | `recordAbandon(${idx})` | `data-action="record-abandon" data-index="${idx}"` |
      | `openCmsInfoModal('${d.key}')` | `data-action="open-cms" data-key="${d.key}"` |
      | `updateOrderStepFromStore(${s})` | `data-action="set-step" data-step="${s}"` |
- [x] 動態 template string 產生的元素同樣使用 `data-action` → **不需重新綁定事件**

**驗收**：`grep -c 'onclick=' *.html` 全部為 0；所有按鈕功能正常。

---

## T11 — 回歸測試 `tests/smoke.mjs`

**目標**：讓「保持目前頁面功能」有可重複驗證的手段（解決 P4）。

- [x] 以 headless Chrome + CDP 撰寫腳本（Node 內建 `fetch` + `WebSocket`，**零外部依賴**）
- [x] 腳本自動啟動本地 server、跑完所有案例、輸出 PASS/FAIL 表格、exit code 反映結果
- [x] 覆蓋案例（對應 PLAN §7）：
      | 案例 | 內容 |
      |---|---|
      | S1 | 首頁載入、輪播標題與指示條正確 |
      | S2 | 輪播下一張 / 上一張 / 指示條點擊 |
      | S3 | 進入店家詳情、加購、數量增減、購物車小計 |
      | S4 | 未達起送門檻顯示「還差 N 份起送」、達門檻可下單 |
      | S5 | 送出訂單 → 跳追蹤頁 → 追蹤頁出現新單號 |
      | S6 | 店家接單頁接受訂單 + 推進 3 階段 |
      | S7 | 追蹤頁進度條 / ETA 隨階段變化 |
      | S8 | 主控台停權店家 → 首頁按鈕 disabled + 顯示「後台已暫停接單」 |
      | S9 | 主控台黑名單顧客 → 首頁阻擋下單 |
      | S10 | 主控台編輯 CMS → 首頁彈窗顯示新內容 |
      | S11 | 主控台棄單計數 ≥ 2 → 自動列入黑名單 |
      | S12 | `loadState()` 缺欄位時不清空訂單（單元測試） |
- [x] 執行方式：`node tests/smoke.mjs`

**驗收**：`node tests/smoke.mjs` 全數 PASS。

---

## T12 — 文件與版本同步

- [x] `README.md`：專案簡介、目錄結構、啟動方式（`./serve.sh`）、頁面角色說明、常見問題
- [x] `CHANGELOG.md`：新增 `1.0.0` 条目（本為首次建立結構化版本）
- [x] 確認 `README.md` / `PLAN.md` / `TASK.md` / `CHANGELOG.md` 的 `project_version` 一致
- [x] 更新本檔任務狀態為已完成

**驗收**：版本號一致；文件與實作相符。

---

## 風險檢查清單（每個 Task 完成後必跑）

```bash
# A1 無 inline style / script（tailwind-config 與 guard 為外部檔，應為 0）
grep -n '<style\|<script>' *.html | grep -v 'src=' 

# A2 無 inline onclick
grep -c 'onclick=' *.html

# A3 共用狀態庫只存在一份
grep -rln 'SHARED_STORAGE_KEY\|getDefaultSharedState' .

# 語法檢查（所有 js 檔）
for f in $(find js -name '*.js'); do node --check "$f" || echo "SYNTAX FAIL: $f"; done

# 回歸測試
node tests/smoke.mjs
```

---

## 變更紀錄

| 日期 | 變更 | 版本 |
|---|---|---|
| 2026/10/21 | 建立 TASK.md，拆解為 T0~T12 共 13 個任務 | 1.0.0 |

| 2026/10/22 | 完成 T6~T12：頁面模組拆分、事件委派改造、回歸測試套件（14 案例 / 70 項檢查全數通過）、舊版 vs 新版 DOM 與樣式逐項比對無差異 | 1.0.0 |
