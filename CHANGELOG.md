---
name: "CHANGELOG.md"
description: "來電送 CALL & DELIVER — 變更紀錄（版本單一事實來源）"
created_date: "2026/10/21"
modified_date: "2026/10/22"
project_version: "1.1.0"
document_version: "1.0.1"
agent_sign: ['human/justin', 'claude/claude-sonnet-4-6']
---

# 變更紀錄 (CHANGELOG)

本檔為專案**版本號的單一事實來源 (Source of Truth)**。
`README.md`、`PLAN.md`、`TASK.md`、`CLASS-AUDIT.md` 的 `project_version` 必須與本檔一致。

版本格式：`MAJOR.MINOR.PATCH`
- **MAJOR**：不相容的 API 變更
- **MINOR**：向下相容的新功能
- **PATCH**：向下相容的錯誤修正

---

## [1.1.0] — 2026/10/22

### 新增
- `CLASS-AUDIT.md`：各頁面 class 屬性分析總整理
  （總量統計、樣式來源分類、變體與類別分布、設計尺度一致性、元件化候選）
- `tests/class-audit.mjs`：class 稽核工具（零外部相依，Node 內建 `fetch` / `WebSocket`）
  - 靜態擷取：HTML `class` 屬性、JS template 字串內的 `class` 屬性、
    `const xxxClass = '...'` 形式的 class 字串常數
  - 瀏覽器分類：以 Tailwind Play CDN **實際產生的樣式表**為準，
    將每個 class 分為「Tailwind 產出 / 本地自訂 CSS / 查無對應」
  - 失效驗證：對「查無對應」的 class，在真實頁面上移除該 class 後
    比對 38 項計算樣式，確認是否為**靜默失效 (silent no-op)**
  - 支援 `--no-browser`（僅靜態分析）與 `--json`（機器可讀輸出）

### 稽核發現（**尚未修正，待決**）
- **12 項 class 靜默失效**：專案使用 Tailwind Play CDN **v3.4.17**，
  但使用了 **v4 才有的**類名（`shadow-xs` × 12、`shadow-2xs` × 2、
  `backdrop-blur-xs` × 6），以及**間距刻度不存在的數值**
  （`md:py-4.5`、`sm:left-13`、`sm:right-13`）—— 皆不產生任何 CSS 且無錯誤訊息
- **3 處鍵盤 focus 圈被遮蔽**：`user_order_track.html` 的進度按鈕帶有
  `focus:outline-none`，實測會把 `css/base.css` 的磚紅色 focus 圈轉為透明
- 3 個 `group` class 全站無任何 `group-*` 變體配套，屬無作用標記

### 驗證
- `tests/class-audit.mjs`：4 頁合計 452 個不重複 class token，
  906 個由 Tailwind 產出、2 個由本地 CSS 定義、12 項靜默失效（已全數實測確認）
- 6 個建議替代 class 皆已實測確認會在目前的 CDN 版本下產出 CSS

---

## [1.0.0] — 2026/10/21

### 結構重構
- 將 4 個 Monolithic HTML（合計 3130 行）拆分為 `html / css / js` 三層職責分離結構
- 新增 `css/base.css`（全站共用樣式）與 `css/pages/*.css`（各頁專屬樣式）
- 新增 `js/core/`（跨頁共用模組）與 `js/pages/`（各頁專屬邏輯）
- Tailwind 主題設定由 4 份 inline script 外移為 `js/core/tailwind-config.js`
- Logo 移至 `assets/` 目錄

### 修正
- **修正共用狀態庫 4 份重複副本分歧造成的資料遺失風險**：
  `index.html` 與 `controller.html` 的 `loadSharedState()` 原本要求狀態必須含
  `cmsDocs`，否則會**整份重置為預設值並清空全部訂單與顧客資料**；
  現統一由 `js/core/store.js` 處理，改為逐欄位補齊，**任何情況下都不清除既有訂單**
- 修正主控台 `resetSharedPrototypeData()` 與 `loadSharedState()` 之間的資料流不一致

### 新增
- `serve.sh`：一鍵啟動本地開發伺服器（原生 ES Module 需 http:// 協定）
- `js/core/file-protocol-guard.js`：以 `file://` 開啟時給出明確指引，避免無聲失敗
- `tests/smoke.mjs`：headless Chrome 回歸測試，覆蓋 4 頁核心流程與跨頁即時同步
- `PLAN.md` / `TASK.md`：重構設計依據與執行任務表

### 開發流程
- 48 個 inline `onclick` 全數改為 `data-action` + `document` 層級事件委派，
  動態產生的元素不再需要重新綁定事件
- 共用狀態庫 API 統一為 `loadState / saveState / getState / updateState / resetState / subscribe`

### 驗證
- `tests/smoke.mjs`：14 個案例 / 70 項檢查，**全部通過**
  （涵蓋輪播、加購與起送門檻、下單跳轉、三階段推進、跨分頁即時同步、
  黑名單阻擋、CMS 編輯傳播、棄單自動封鎖、`loadState()` 資料遺失防護、
  `file://` 守衛、四頁 console 零錯誤）
- 舊版（git `HEAD`）與新版逐元素比對：4 頁共 117 個帶 id 元素的
  位置、尺寸、文字內容與計算樣式**完全一致**，視覺無回歸
