---
name: "PLAN.md"
description: "來電送 CALL & DELIVER — 前端 B 組 Monolithic Script 重構計畫"
created_date: "2026/10/21"
modified_date: "2026/10/22"
project_version: "1.0.0"
document_version: "1.0.1"
agent_sign: ['human/justin', 'claude/claude-sonnet-4-6']
---

# 來電送 前端 B 組 — Monolithic Script 重構計畫

> 本文件是**重構的設計依據**（做什麼、為什麼、怎麼驗）。
> 實際執行步驟與進度請見 [TASK.md](./TASK.md)。

---

## 1. 問題陳述

目前 4 個頁面全部由 Antigravity Agent 各自獨立生成，**未經職責分離**：

| 檔案 | 行數 | inline `<style>` | inline `<script>` | inline `onclick` |
|---|---|---|---|---|
| `index.html` | 1093 | 18 行 | 683 行 | 23 |
| `controller.html` | 865 | 7 行 | 509 行 | 12 |
| `order_accept.html` | 652 | 18 行 | 394 行 | 8 |
| `user_order_track.html` | 520 | 7 行 | 281 行 | 5 |
| **合計** | **3130** | 50 | **1867** | **48** |

主要問題：

### P1 — 共用狀態庫被複製 4 份（**最高風險，屬實質 Bug**）

`SHARED_STORAGE_KEY` / `getDefaultSharedState()` / `loadSharedState()` / `saveSharedState()`
在 4 個檔案中各存在一份，合計約 **480 行重複程式碼**。

四份複本**已經產生分歧**：

| 檔案 | `loadSharedState()` 的驗證條件 | 行為差異 |
|---|---|---|
| `index.html:586` | `stores && customers && orders && cmsDocs` | 缺 `cmsDocs` → **整份狀態重置為預設，訂單全部被清空** |
| `controller.html` | `stores && customers && orders && cmsDocs` | 同上 |
| `order_accept.html:335` | `stores && customers && orders` | 缺 `cmsDocs` → 只讀不重置 |
| `user_order_track.html:316` | `stores && customers && orders` | 只讀不重置 |

→ 只要有任何一條路徑寫入的狀態缺少 `cmsDocs`，顧客端 `index.html` 會**靜默清空全站訂單與黑名單資料**。
這是複製程式碼直接造成的資料遺失風險，必須在本次重構一併修掉。

### P2 — 職責未分離

- CSS 寫在 `<style>` 內（四頁重複 `body` 樣式）；Tailwind 主題設定寫在 `<head>` 的 inline script（重複 4 份）。
- 業務邏輯、資料、樣式、事件綁定全部混在同一個 `.html` 檔案，無法獨立測試、無法獨立重用。

### P3 — 48 個 inline `onclick` 直呼全域函式

包含大量寫在 JS template string 裡的 inline handler（例如 `onclick="changeQty(${item.id}, -1)"`）。
每次重新渲染都產生新的 inline handler 字串，無法統一移除/攔截，也讓「新增功能」必須同步改 HTML 字串。

### P4 — 無任何驗證手段

沒有測試、沒有 lint、沒有 changelog。每次修改都只能靠人工點擊 4 個頁面回歸。

---

## 2. 關鍵技術決策（實測依據）

### 2.1 實測結果

以 headless Chrome 155 + CDP 實測（`file://` 與 `http://` 雙協定）：

| 能力 | `file://`（雙擊開啟） | `http://`（本地伺服器） |
|---|---|---|
| 現行 4 頁載入 + 初始化 | ✅ 正常 | ✅ 正常 |
| Tailwind / Lucide CDN 套用 | ✅ 正常 | ✅ 正常 |
| `localStorage` 讀寫 | ✅ 正常（origin = `file://`） | ✅ 正常 |
| **跨分頁 `storage` 事件（即時同步）** | ✅ **正常**（實測 controller 表格即時更新） | ✅ 正常 |
| **ES Module `<script type="module">`** | ❌ **被 CORS 阻擋，ESM 完全不會執行** | ✅ 正常 |

> 實測原始碼見 `tests/` 目錄（本次重構一併產出）。

### 2.2 結論與選擇

**採用原生 ES Modules**（`import` / `export`），理由：

1. **可維護性最佳** — 相依關係由瀏覽器在載入時強制驗證。缺少 export 會直接報錯；
   相較之下 classic script 是「載入順序錯了就靜默壞掉」（`xxx is not a function`），
   這在 4 個頁面 × 4 份重複程式碼的規模下是最大的日常維護風險。
2. **最易增刪功能** — 新增功能 = 新增一個 module + 一行 `import`；
   刪除功能 = 刪掉檔案 + 移除 import。不需要維護「script 順序清單」。
3. **消除 P1** — `js/core/store.js` 成為全站唯一真相來源，4 份分歧自動消失。
4. **消除 P3** — ESM 沒有全域函式，強制我們把 inline `onclick` 改為事件委派，
   這正是「易增刪功能」的關鍵改進。

**`file://` 限制的處理（務必落實，不可省略）**：

| 措施 | 說明 |
|---|---|
| `serve.sh` | 一鍵 `./serve.sh` 啟動 `python3 -m http.server 8080`，避免每人自己找指令 |
| `js/core/file-protocol-guard.js` | 偵測到 `location.protocol === 'file:'` 時，於畫面顯示**明確指引**（而非神祕白畫面），並提供啟動指令 |
| `README.md` | 明確標示「請勿雙擊開啟」 |

> **回滾方案**：若最終決定必須支援雙擊開啟，`js/core/*.js` 與 `js/pages/*.js`
> 改寫為 `App.core.xxx = {...}` 命名空間物件即可（僅需調整檔案尾端匯出語法與 HTML 的 script 標籤），
> 其餘 UI/業務邏輯完全不動。設計上已預留此路徑。

---

## 3. 目標架構

```
dm/
├── index.html                      # 顧客首頁（輪播 / 店家詳情 / 購物車 / 撥號確認）
├── order_accept.html               # 店家接單頁（含 Web Audio 叮咚提醒）
├── user_order_track.html           # 顧客訂單追蹤頁（三階段進度）
├── controller.html                 # 主控台（店家 / 顧客 / 後台編輯）
│
├── assets/
│   └── CoDeliver-logo-1020x1020px-20261021.svg
│
├── css/
│   ├── base.css                    # 全站共用：body、字體、共用元件、a11y focus
│   └── pages/
│       ├── index.css               # 首頁專屬：.out-of-range-mask
│       ├── order-accept.css        # 接單頁專屬：.incoming-order-banner
│       ├── user-order-track.css    # 追蹤頁專屬（現況無專屬樣式，保留擴充位）
│       └── controller.css          # 主控台專屬（現況無專屬樣式，保留擴充位）
│
├── js/
│   ├── core/
│   │   ├── tailwind-config.js      # ⚠ 必須是 classic script（見 §6.1）
│   │   ├── file-protocol-guard.js  # ⚠ 必須是 classic script（見 §6.2）
│   │   ├── seed-data.js            # 種子資料單一真相來源
│   │   ├── store.js                # 共用狀態庫單一真相來源（修正 P1）
│   │   ├── dom.js                  # DOM / 格式化工具
│   │   └── toast.js                # 共用提示元件
│   └── pages/
│       ├── index.js
│       ├── order-accept.js
│       ├── user-order-track.js
│       └── controller.js
│
├── tests/
│   └── smoke.mjs                   # headless Chrome 回歸測試（4 頁核心流程）
│
├── serve.sh                        # 一鍵啟動本地伺服器
├── README.md
├── PLAN.md
├── TASK.md
└── CHANGELOG.md
```

### 職責劃分原則

| 檔案類型 | 允許內容 | 禁止內容 |
|---|---|---|
| `*.html` | 語意化結構、`data-*` 屬性、`<link>` / `<script>` 參照 | `<style>` 內嵌樣式、`<script>` 內嵌邏輯、`onclick` 屬性 |
| `css/base.css` | 全站共用樣式 | 頁面專屬樣式 |
| `css/pages/*.css` | 單頁專屬樣式 | 他頁樣式 |
| `js/core/*` | 跨頁共用邏輯，純函式優先 | 直接操作特定頁面 DOM |
| `js/pages/*` | 該頁專屬的狀態與渲染 | 跨頁共用邏輯（應下沉到 core） |

---

## 4. 各頁面分析

### 4.1 `index.html` — 顧客首頁

**現況**：單一 HTML 內含「首頁」與「店家詳情」兩個 view（`#page-home` / `#page-detail`，以 `hidden` class 切換），
外加「撥號確認」modal（`#modal-call`）與「平台條款」modal（`#modal-cms-info`）。

| 職責 | 現況位置 | 拆分後位置 |
|---|---|---|
| 首頁輪播（自動播放 / 上下一張 / 指示條） | `updateCarousel` `startCarousel` `nextSlide` `prevSlide` `goToSlide` | `js/pages/index.js` |
| 店家詳情 view 切換 | `openRestaurant` `refreshDetailView` `openCurrentRestaurant` `goToHome` | `js/pages/index.js` |
| 菜單渲染 / 數量增減 / 購物車小計 | `renderDetailMenu` `changeQty` `updateCartUI` | `js/pages/index.js` |
| 外送範圍模擬（mask 遮罩） | `toggleRangeSimulation` `updateRangeStateUI` `showRangeWarning` | `js/pages/index.js` + `css/pages/index.css` |
| 顧客身分選擇 / 黑名單阻擋 | `populateCustomerSelect` `onCustomerSelectChange` | `js/pages/index.js`（讀 `core/store` 的 `customers`） |
| 送出訂單 → 跳追蹤頁 | `handleBuyClick` `submitOrderAndGoTrack` | `js/pages/index.js` |
| CMS 條款彈窗（條款/客服/介紹/FAQ） | `openCmsInfoModal` `closeCmsInfoModal` | `js/pages/index.js` |
| Toast 提示 | `showToastWarning` | `js/core/toast.js`（共用） |
| 餐廳目錄 + 菜單資料 | `baseRestaurantsData` | `js/core/seed-data.js` |
| `body` 樣式 | inline `<style>` | `css/base.css` |

**關鍵行為（重構後必須維持）**
- `?store=<id>` 網址參數可直接開啟指定店家。
- 起送門檻：`count < minQty` 時按鈕變色並顯示「還差 N 份起送」。
- 店家被主控台停權 → 按鈕 disabled、購物車清單半透明、顯示「後台已暫停接單」。
- 黑名單顧客 → 撥號按鈕 disabled 並顯示棄單次數警語。
- 送出訂單寫入 `orders`、更新 `customers[].orders`、設定 `activeOrderId`、跳轉追蹤頁。

### 4.2 `order_accept.html` — 店家接單頁

| 職責 | 現況位置 | 拆分後位置 |
|---|---|---|
| 訂單列表切換 / 渲染 | `switchMockOrder` `renderOrder` | `js/pages/order-accept.js` |
| 接受訂單 + 訂單摘要 modal | `acceptOrder` `closeAcceptedModal` | `js/pages/order-accept.js` |
| 推進配送階段（3 階段） | `updateOrderStepFromStore` | `js/pages/order-accept.js` |
| Web Audio「叮咚」提醒 + 迴圈響鈴 | `isStoreSoundEnabledForOrder` `scheduleChimeNotes` `playIncomingOrderChime` `syncOrderAlertSound` `stopOrderAlertSound` | `js/pages/order-accept.js`（獨立模組 `audio` 區塊） |
| 瀏覽器音訊解鎖（首次手勢） | `initOrderPage` 內 `unlockAudio` | `js/pages/order-accept.js` |
| 狀態同步 | `syncFromStorage` + `storage` 事件 | `js/core/store.js` 的 `subscribe()` |

**關鍵行為**
- 瀏覽器自動播放限制：必須在使用者手勢後 `resume()` AudioContext 才能出聲。
- 僅當「該訂單所屬店家」在主控台開啟音效時才響鈴（`stores[].soundEnabled`）。
- 音效為六音「叮咚和弦」（E5/G5/C6 兩次），含 triangle 泛音。

### 4.3 `user_order_track.html` — 顧客訂單追蹤頁

| 職責 | 現況位置 | 拆分後位置 |
|---|---|---|
| 多筆訂單單號切換 | `renderOrderTabs` `switchUserOrder` | `js/pages/user-order-track.js` |
| 目前訂單渲染（摘要 / 明細 / 合計） | `renderActiveOrder` | `js/pages/user-order-track.js` |
| 三階段進度條與 ETA 文字 | `setTrackStep` `applyTrackStepUI` | `js/pages/user-order-track.js` |
| 階段定義（label / eta / desc） | `trackStages` | `js/pages/user-order-track.js`（頁面專屬常數） |
| 明細摺疊 | `toggleOrderSummary` | `js/pages/user-order-track.js` |
| 狀態同步 | `syncOrdersFromStorage` + `storage` 事件 | `js/core/store.js` 的 `subscribe()` |

**關鍵行為**
- 三階段：店家接單 → 已製作完成 → 已送達；進度條寬度 0% / 50% / 100%。
- 尚未被店家接單（`accepted === false`）時，徽章顯示「待店家接單確認」（琥珀色）。
- 顧客端可手動切換階段，寫回共用狀態庫。

### 4.4 `controller.html` — 主控台

| 職責 | 現況位置 | 拆分後位置 |
|---|---|---|
| 三大頁籤切換 | `switchMainTab` | `js/pages/controller.js` |
| 頂部 / 側欄統計 | `updateTopStats` | `js/pages/controller.js` |
| 店家表格 + 音效/權限切換 | `renderStoresTable` `toggleStoreSound` `toggleStoreActive` | `js/pages/controller.js` |
| 顧客表格 + 棄單計數 + 黑名單 | `renderCustomersTable` `recordAbandon` `toggleCustomerBlacklist` | `js/pages/controller.js` |
| 條款 / 客服 / 介紹 / FAQ 編輯 | `renderCmsNav` `switchCmsDoc` `renderCmsContent` `toggleCmsEdit` `cancelCmsEdit` | `js/pages/controller.js` |
| 跳轉訂單追蹤 | `jumpToOrder` | `js/pages/controller.js` |
| 重置測試資料 | `resetSharedPrototypeData` | `js/pages/controller.js` |
| Toast 提示 | `showToast` | `js/core/toast.js`（與首頁共用） |

**關鍵行為**
- 棄單累計達 2 次自動列入黑名單。
- CMS 編輯時若收到跨分頁更新，不覆蓋正在編輯的內容（`isEditingCms` 判斷）。

---

## 5. 共用模組介面契約

### `js/core/seed-data.js`

```js
export const restaurants;    // 首頁 3 家餐廳目錄（含 menu 菜單）
export const stores;         // 後台店家設定（id/name/soundEnabled/hours/minOrder/minQty/active）
export const customers;      // 顧客（id/name/tel/orders/abandonedCount/blacklisted）
export const orders;         // 訂單（orderId/storeId/.../accepted/step/items）
export const cmsDocs;        // 條款 / 客服 / 介紹 / FAQ
export function createDefaultState();  // → { version, activeOrderId, stores, customers, orders, cmsDocs }
```

### `js/core/store.js`

```js
export const STORAGE_KEY;    // 'laidiansong_shared_state_v1'
export const STATE_VERSION;  // 2
export function loadState();        // 讀取 + 欄位補齊 + 版本遷移（**絕不整份重置**）
export function saveState(state);
export function getState();         // 目前記憶體快照
export function updateState(fn);    // fn(state) => void；寫回並通知訂閱者
export function resetState();       // 重置為種子資料
export function subscribe(fn);      // 訂閱跨分頁變更；回傳 unsubscribe 函式
```

> **P1 修正重點**：`loadState()` 改為「逐欄位補齊 + 版本遷移」，
> 缺 `cmsDocs` 只補種子值，**不再清空 `orders` / `customers` / `stores`**。

### `js/core/toast.js`

```js
export function showToast(message, { variant = 'info' } = {});  // variant: 'info' | 'success' | 'warning'
```

### `js/core/dom.js`

```js
export const $;             // querySelector 糖
export const $$;            // querySelectorAll 糖
export function refreshIcons();        // 安全呼叫 lucide.createIcons()
export function formatDeliverBy(t);    // '12:15' → '12:15 前送到'
export function formatMoney(n);        // 1234 → 'NT$ 1,234'
```

### 事件委派約定（取代 inline `onclick`）

```html
<button data-action="change-qty" data-item-id="101" data-delta="-1">
```

每頁一個 `document` 層級的 delegated listener，依 `data-action` 分派到對應 handler。
優點：**template string 產生的動態元素不需要重新綁定事件**（P3 根治）。

---

## 6. 實作注意事項

### 6.1 `tailwind-config.js` 必須是 classic script

Tailwind Play CDN 依賴 `window.tailwind.config` 的 **setter** 觸發重新產生 CSS。
若改成 `<script type="module">`，模組會被 defer 到 DOM 解析完後才執行，
設定晚於 Tailwind 首次產檔 → `brick` 主題色可能短暫失效（FOUC）或不被套用。

→ `js/core/tailwind-config.js` 以**傳統 script**引入，且必須緊接在 Tailwind CDN 之後：

```html
<script src="https://cdn.tailwindcss.com"></script>
<script src="./js/core/tailwind-config.js"></script>
```

### 6.2 `file-protocol-guard.js` 必須是 classic script

需在頁面繪製前就攔截並顯示提示，故不能 defer → 同樣使用傳統 script。

### 6.3 CSS 載入順序

`<link href="css/base.css">` 必須置於 Tailwind CDN script **之後**，
以維持與現況（inline `<style>` 在 CDN 之後）相同的層疊結果：
Tailwind Play CDN 注入的 `<style>` 位於 `<head>` 尾端，優先於 `base.css` 的同名規則。

### 6.4 資源路徑

Logo 由根目錄移至 `assets/`，4 個 HTML 的 `src` 需一併更新為 `./assets/CoDeliver-logo-1020x1020px-20261021.svg`。

### 6.5 初始化時機

現況為 `window.onload = initApp`。ESM 為 defer 執行，改用 `DOMContentLoaded` 監聽即可；
需確保 `lucide` 全域已就緒（Lucide CDN 為 blocking classic script，先於 defer 模組執行 → 順序安全）。

---

## 7. 驗收標準

| # | 驗收項 | 判定方式 |
|---|---|---|
| A1 | 4 個 HTML 檔不含任何 inline `<style>` 與 inline `<script>`（除 tailwind-config / guard 兩個 classic 外部檔） | grep 檢查 |
| A2 | 4 個 HTML 檔不含任何 `onclick=` 屬性 | grep 檢查 |
| A3 | `SHARED_STORAGE_KEY` / `getDefaultSharedState` / `loadSharedState` / `saveSharedState` 在整個 repo 只出現一次 | grep 檢查 |
| A4 | 首頁輪播自動播放、左右切換、指示條點擊正常 | 自動化測試 |
| A5 | 首頁加入購物車 → 未達門檻變色 → 達門檻可下單 → 跳追蹤頁 | 自動化測試 |
| A6 | 店家接單頁可接受訂單、推進 3 階段 | 自動化測試 |
| A7 | 顧客追蹤頁進度條與 ETA 隨階段正確變化 | 自動化測試 |
| A8 | 主控台切換店家停權 → 首頁按鈕變 disabled 且顯示「後台已暫停接單」 | 跨頁測試 |
| A9 | 主控台將顧客設為黑名單 → 首頁阻擋下單 | 跨頁測試 |
| A10 | 主控台編輯 CMS 條款 → 首頁彈窗顯示新內容 | 跨頁測試 |
| A11 | 主控台棄單計數達 2 → 自動列入黑名單 | 自動化測試 |
| A12 | 視覺無回歸（版面與現況一致） | 截圖比對 |
| A13 | `loadState()` 遇缺欄位時**不清空**訂單與顧客資料 | 單元測試 |

### 7.1 驗收結果（2026/10/22 實測）

| # | 結果 | 驗證方式與數據 |
|---|---|---|
| A1 | ✅ 通過 | 4 個 HTML 之 inline `<style>` / inline `<script>` 命中數皆為 **0** |
| A2 | ✅ 通過 | 4 個 HTML 之 `onclick=` / `onchange=` 命中數皆為 **0**（原 48 個 inline handler 全數改為 `data-action` 委派） |
| A3 | ✅ 通過 | `SHARED_STORAGE_KEY` / `getDefaultSharedState` / `loadSharedState` / `saveSharedState` 於 repo 內僅命中 `js/core/seed-data.js` 的**說明註解**，實作僅存在 `js/core/store.js` |
| A4 | ✅ 通過 | `tests/smoke.mjs` S1 / S2 |
| A5 | ✅ 通過 | `tests/smoke.mjs` S3 / S4 / S5 |
| A6 | ✅ 通過 | `tests/smoke.mjs` S6 |
| A7 | ✅ 通過 | `tests/smoke.mjs` S7 |
| A8 | ✅ 通過 | `tests/smoke.mjs` S8（跨分頁 `storage` 事件即時同步） |
| A9 | ✅ 通過 | `tests/smoke.mjs` S9 |
| A10 | ✅ 通過 | `tests/smoke.mjs` S10 |
| A11 | ✅ 通過 | `tests/smoke.mjs` S11 |
| A12 | ✅ 通過 | 舊版（git `HEAD`）與新版逐元素比對：4 頁共 **117 個帶 id 元素**的位置、尺寸、文字內容、計算樣式（color / background / font-size / font-weight / display）**完全一致**；`body` 背景 `rgb(248, 246, 244)`、字體 `"Noto Sans TC", sans-serif` 一致 |
| A13 | ✅ 通過 | `tests/smoke.mjs` S12：寫入「缺 `cmsDocs`、保留 `orders`」的狀態後呼叫 `loadState()`，`orders` 筆數不變且 `cmsDocs` 自動補齊、`version` 遷移至 `2` |

> 額外驗證（S13 / S14，非原驗收項）：
> S13 以 `file://` 開啟時顯示明確指引畫面（含 `./serve.sh` 指令）而非白畫面；
> S14 確認 4 個頁面載入過程 **console 錯誤數為 0**。

---

## 8. 風險與緩解

| 風險 | 等級 | 緩解措施 |
|---|---|---|
| 改成 ESM 後 `file://` 無法開啟 | 高 | `serve.sh` + `file-protocol-guard.js` 明確指引 + README；並預留 classic 回滾路徑（§2.2） |
| Tailwind 主題色因載入順序失效 | 中 | 依 §6.1 保持 classic script；重構後以截圖驗證 `text-brick` 實際色值 |
| 事件委派改寫遺漏功能 | 中 | `tests/smoke.mjs` 覆蓋 4 頁核心流程；重構前後各跑一次比對 |
| localStorage 舊格式相容 | 中 | `STATE_VERSION` + 遷移函式，欄位缺漏以種子值補齊 |
| 工作時間不足 | 中 | TASK.md 依「先基礎、後頁面」順序切分，每個 Task 皆可獨立驗收與提交 |

---

## 9. 不在本次範圍

- 後端 API / 真實資料庫（目前為 localStorage 原型）
- 建置工具（Vite / npm）—— 維持零依賴靜態網站
- 單元測試框架（以 `tests/smoke.mjs` 腳本化回歸測試取代）
- 視覺重新設計（僅做版面等價的結構拆分）

---

## 10. 變更紀錄

| 日期 | 變更 | 版本 |
|---|---|---|
| 2026/10/21 | 建立 PLAN.md，完成現況分析、問題盤點（P1~P4）、目標結構設計與驗收標準 | 1.0.0 |
| 2026/10/22 | 補上 §7.1 驗收結果（A1~A13 全數通過）；`loadState()` 命名與實作對齊 | 1.0.0 |
