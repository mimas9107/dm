---
name: "CHANGELOG.md"
description: "來電送 CALL & DELIVER — 變更紀錄（版本單一事實來源）"
created_date: "2026/10/21"
modified_date: "2026/10/21"
project_version: "1.0.0"
document_version: "1.0.0"
agent_sign: ['human/justin', 'claude/claude-sonnet-4-6']
---

# 變更紀錄 (CHANGELOG)

本檔為專案**版本號的單一事實來源 (Source of Truth)**。
`README.md`、`PLAN.md`、`TASK.md` 的 `project_version` 必須與本檔一致。

版本格式：`MAJOR.MINOR.PATCH`
- **MAJOR**：不相容的 API 變更
- **MINOR**：向下相容的新功能
- **PATCH**：向下相容的錯誤修正

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
