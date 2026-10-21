/* ==========================================================================
   主控台 (controller.js)
   --------------------------------------------------------------------------
   對應 controller.html。負責：
     1. 三大頁籤切換（店家資料 / 顧客資料 / 後台編輯）
     2. 頂部與側欄統計數據
     3. 店家表格：通知音效與接單權限切換
     4. 顧客表格：棄單計數與黑名單權限切換
     5. 後台編輯：條款 / 客服 / 介紹 / FAQ 的檢視與編輯

   所有變更皆寫回共用狀態庫，前台頁面會透過 storage 事件即時同步。
   ========================================================================== */

import { getState, loadState, resetState, updateState, subscribe } from '../core/store.js';
import { $, delegateActions, escapeHtml, formatTimestamp, refreshIcons } from '../core/dom.js';
import { showToast } from '../core/toast.js';

/* --------------------------------------------------------------------------
   頁面狀態
   -------------------------------------------------------------------------- */
let storesAdminData = [];
let customersAdminData = [];
let cmsDocsData = [];

let currentMainTab = 'stores';
let currentCmsIdx = 0;
let isEditingCms = false;

/* --------------------------------------------------------------------------
   狀態同步
   -------------------------------------------------------------------------- */
function syncDataRefs() {
  const state = loadState();
  storesAdminData = state.stores;
  customersAdminData = state.customers;
  cmsDocsData = state.cmsDocs;
}

/* --------------------------------------------------------------------------
   頁籤切換
   -------------------------------------------------------------------------- */
function switchMainTab(tabKey) {
  currentMainTab = tabKey;
  const tabs = ['stores', 'customers', 'cms'];

  tabs.forEach(key => {
    const btn = document.getElementById(`tab-btn-${key}`);
    const panel = document.getElementById(`tab-panel-${key}`);
    const isActive = key === tabKey;

    if (btn) {
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.className = isActive
        ? 'flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-1.5 cursor-pointer bg-brick text-white shadow-sm'
        : 'flex-1 md:flex-initial px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer text-stone-700 hover:text-stone-900 hover:bg-white/60';
    }

    if (panel) {
      if (isActive) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    }
  });

  refreshIcons();
}

/* --------------------------------------------------------------------------
   統計數據
   -------------------------------------------------------------------------- */
function updateTopStats() {
  const totalStores = storesAdminData.length;
  const activeStores = storesAdminData.filter(s => s.active).length;
  const suspendedStores = totalStores - activeStores;

  $('#stat-store-count').innerText = totalStores;
  $('#panel-store-badge').innerText = `啟用中 ${activeStores} / ${totalStores}`;
  $('#sidebar-store-total').innerText = totalStores;
  $('#sidebar-store-active').innerText = activeStores;
  $('#sidebar-store-suspended').innerText = suspendedStores;

  const totalCust = customersAdminData.length;
  const blacklistedCust = customersAdminData.filter(c => c.blacklisted).length;
  const normalCust = totalCust - blacklistedCust;

  $('#stat-customer-count').innerText = totalCust;
  $('#stat-blacklist-count').innerText = blacklistedCust;
  $('#panel-customer-badge').innerText = `共 ${totalCust} 位顧客`;
  $('#sidebar-cust-normal').innerText = normalCust;
  $('#sidebar-cust-blacklisted').innerText = blacklistedCust;
}

/* --------------------------------------------------------------------------
   1. 店家資料表格
   -------------------------------------------------------------------------- */
function renderStoresTable() {
  const tbody = $('#store-table-body');
  if (!tbody) return;

  tbody.innerHTML = storesAdminData.map((store, idx) => {
    const soundBtnClass = store.soundEnabled
      ? 'bg-brick-light text-brick border-red-200/80'
      : 'bg-stone-100 text-stone-500 border-stone-200';
    const soundLabel = store.soundEnabled ? '🔔 叮咚開啟' : '🔕 靜音';

    const authBtnClass = store.active
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
      : 'bg-stone-200 text-stone-600 border-stone-300 hover:bg-stone-300';
    const authLabel = store.active ? '正常接單' : '已停權';

    return `
      <tr class="${store.active ? '' : 'opacity-60 bg-stone-50'}">
        <td class="py-3 pr-2 align-top">
          <div class="font-black text-stone-900">${escapeHtml(store.name)}</div>
          <button data-action="toggle-store-sound" data-index="${idx}" class="mt-1 px-2 py-0.5 rounded-md border text-xs font-bold transition active:scale-95 cursor-pointer ${soundBtnClass}">
            ${soundLabel}
          </button>
        </td>
        <td class="py-3 px-2 align-top font-mono font-bold text-stone-700 whitespace-nowrap">
          ${escapeHtml(store.hours)}
        </td>
        <td class="py-3 px-2 align-top font-mono font-bold text-stone-700 whitespace-nowrap">
          ${escapeHtml(store.minOrder)}
        </td>
        <td class="py-3 pl-2 align-top text-right whitespace-nowrap">
          <button data-action="toggle-store-active" data-index="${idx}" class="px-2.5 py-1 rounded-lg border text-xs font-bold transition active:scale-95 cursor-pointer ${authBtnClass}">
            ${authLabel}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  refreshIcons();
}

function toggleStoreSound(idx) {
  const index = Number(idx);
  if (!Number.isInteger(index) || !storesAdminData[index]) return;

  updateState(s => {
    const store = s.stores[index];
    if (!store) return;
    store.soundEnabled = !store.soundEnabled;
  });

  renderStoresTable();
  showToast(
    `已將「${storesAdminData[index].name}」通知音效設為${storesAdminData[index].soundEnabled ? '開啟' : '靜音'}（已同步店家接單頁）`,
    { variant: 'success', position: 'bottom-right' }
  );
}

function toggleStoreActive(idx) {
  const index = Number(idx);
  if (!Number.isInteger(index) || !storesAdminData[index]) return;

  updateState(s => {
    const store = s.stores[index];
    if (!store) return;
    store.active = !store.active;
  });

  renderStoresTable();
  updateTopStats();
  showToast(
    `已將「${storesAdminData[index].name}」權限改為${storesAdminData[index].active ? '正常接單' : '停權狀態'}（已同步前台首頁）`,
    { variant: 'success', position: 'bottom-right' }
  );
}

/* --------------------------------------------------------------------------
   2. 顧客資料表格
   -------------------------------------------------------------------------- */
function renderCustomersTable() {
  const tbody = $('#customer-table-body');
  if (!tbody) return;

  tbody.innerHTML = customersAdminData.map((cust, idx) => {
    const abandonBadge = cust.abandonedCount > 0
      ? `<span class="text-red-600 font-bold">棄單 ${cust.abandonedCount} 次</span>`
      : '<span class="text-stone-400">無棄單</span>';

    const statusBtnClass = cust.blacklisted
      ? 'bg-red-600 hover:bg-red-700 text-white border-red-700 shadow-xs'
      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200';
    const statusLabel = cust.blacklisted ? '🚫 黑名單 (解除)' : '✓ 正常 (設黑名單)';

    const orderLinks = cust.orders.map(ordId =>
      `<button data-action="jump-to-order" data-order-id="${escapeHtml(ordId)}" class="underline-offset-2 hover:underline cursor-pointer">${escapeHtml(ordId)}</button>`
    ).join(', ');

    return `
      <tr class="${cust.blacklisted ? 'bg-red-50/50' : ''}">
        <td class="py-3 pr-2 align-top">
          <div class="font-black ${cust.blacklisted ? 'text-red-700 line-through' : 'text-stone-900'}">${escapeHtml(cust.name)}</div>
          <span class="text-xs font-bold ${cust.blacklisted ? 'text-red-600' : 'text-emerald-700'}">
            ${cust.blacklisted ? '已禁止訂餐' : '權限正常'}
          </span>
        </td>
        <td class="py-3 px-2 align-top font-mono font-bold text-stone-700 whitespace-nowrap">
          ${escapeHtml(cust.tel)}
        </td>
        <td class="py-3 px-2 align-top">
          <div class="font-mono font-bold text-brick">${orderLinks}</div>
          <div class="mt-0.5 flex items-center gap-1.5">
            ${abandonBadge}
            <button data-action="record-abandon" data-index="${idx}" class="px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 text-stone-600 text-xs font-bold cursor-pointer" title="記錄一次棄單">+棄單</button>
          </div>
        </td>
        <td class="py-3 pl-2 align-top text-right whitespace-nowrap">
          <button data-action="toggle-blacklist" data-index="${idx}" class="px-2.5 py-1 rounded-lg border text-xs font-bold transition active:scale-95 cursor-pointer ${statusBtnClass}">
            ${statusLabel}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  refreshIcons();
}

function jumpToOrder(orderId) {
  updateState(s => { s.activeOrderId = orderId; });
  window.location.href = 'user_order_track.html';
}

function recordAbandon(idx) {
  const index = Number(idx);
  if (!Number.isInteger(index) || !customersAdminData[index]) return;

  let message = '';
  let autoBlacklisted = false;

  updateState(s => {
    const cust = s.customers[index];
    if (!cust) return;
    cust.abandonedCount = (cust.abandonedCount || 0) + 1;
    if (cust.abandonedCount >= 2 && !cust.blacklisted) {
      cust.blacklisted = true;
      autoBlacklisted = true;
    }
    message = cust.name;
  });

  const cust = customersAdminData[index];
  if (autoBlacklisted) {
    showToast(`顧客「${message}」累計棄單達 ${cust.abandonedCount} 次，已自動列入黑名單停權`, { variant: 'success', position: 'bottom-right' });
  } else {
    showToast(`已記錄顧客「${message}」棄單 1 次（累計 ${cust.abandonedCount} 次）`, { variant: 'success', position: 'bottom-right' });
  }

  renderCustomersTable();
  updateTopStats();
}

function toggleCustomerBlacklist(idx) {
  const index = Number(idx);
  if (!Number.isInteger(index) || !customersAdminData[index]) return;

  updateState(s => {
    const cust = s.customers[index];
    if (!cust) return;
    cust.blacklisted = !cust.blacklisted;
  });

  renderCustomersTable();
  updateTopStats();

  const cust = customersAdminData[index];
  if (cust.blacklisted) {
    showToast(`已將顧客「${cust.name}」列入黑名單，前台已禁止其使用訂餐權限`, { variant: 'success', position: 'bottom-right' });
  } else {
    showToast(`已解除顧客「${cust.name}」的黑名單限制，恢復正常訂餐權限`, { variant: 'success', position: 'bottom-right' });
  }
}

/* --------------------------------------------------------------------------
   3. 後台編輯區
   -------------------------------------------------------------------------- */
function renderCmsNav() {
  const nav = $('#cms-nav-list');
  if (!nav) return;

  nav.innerHTML = cmsDocsData.map((doc, idx) => {
    const isActive = idx === currentCmsIdx;
    const btnClass = isActive
      ? 'px-3 py-2.5 rounded-xl text-xs font-black bg-brick text-white shadow-xs transition cursor-pointer text-left whitespace-nowrap'
      : 'px-3 py-2.5 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-200/70 transition cursor-pointer text-left whitespace-nowrap';
    return `
      <button data-action="switch-cms-doc" data-index="${idx}" class="${btnClass}">
        ${escapeHtml(doc.shortLabel)}
      </button>
    `;
  }).join('');
}

function switchCmsDoc(idx) {
  const index = Number(idx);
  if (!Number.isInteger(index) || !cmsDocsData[index]) return;

  if (isEditingCms) {
    isEditingCms = false;
  }
  currentCmsIdx = index;
  renderCmsNav();
  renderCmsContent();
}

function renderCmsContent() {
  const doc = cmsDocsData[currentCmsIdx];
  if (!doc) return;

  $('#cms-active-label').innerText = doc.shortLabel;
  $('#cms-content-title').innerText = doc.fullTitle;
  $('#cms-view-box').innerText = doc.content;
  $('#cms-edit-textarea').value = doc.content;
  $('#cms-updated-at').innerText = `最後更新：${doc.updatedAt}`;

  const viewBox = $('#cms-view-box');
  const editBox = $('#cms-edit-textarea');
  const btnEdit = $('#btn-cms-edit');
  const btnCancel = $('#btn-cms-cancel');
  const modeHint = $('#cms-mode-hint');

  if (isEditingCms) {
    viewBox.classList.add('hidden');
    editBox.classList.remove('hidden');
    btnCancel.classList.remove('hidden');
    btnEdit.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i><span>儲存</span>';
    btnEdit.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer';
    modeHint.innerText = '編輯模式中';
    modeHint.className = 'font-bold text-brick';
    editBox.focus();
  } else {
    viewBox.classList.remove('hidden');
    editBox.classList.add('hidden');
    btnCancel.classList.add('hidden');
    btnEdit.innerHTML = '<i data-lucide="pen-line" class="w-3.5 h-3.5"></i><span>Edit</span>';
    btnEdit.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-brick text-white hover:bg-brick-dark shadow-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer';
    modeHint.innerText = '檢視模式';
    modeHint.className = 'font-bold text-stone-500';
  }

  refreshIcons();
}

function toggleCmsEdit() {
  const doc = cmsDocsData[currentCmsIdx];
  if (!doc) return;

  if (!isEditingCms) {
    isEditingCms = true;
    renderCmsContent();
    return;
  }

  const newValue = $('#cms-edit-textarea').value.trim();
  const title = doc.fullTitle;

  updateState(s => {
    const target = s.cmsDocs[currentCmsIdx];
    if (!target) return;
    target.content = newValue || target.content;
    target.updatedAt = formatTimestamp();
  });

  isEditingCms = false;
  renderCmsContent();
  showToast(`已儲存「${title}」修改內容並同步至前台首頁`, { variant: 'success', position: 'bottom-right' });
}

function cancelCmsEdit() {
  isEditingCms = false;
  renderCmsContent();
}

/* --------------------------------------------------------------------------
   重置測試資料
   -------------------------------------------------------------------------- */
function resetSharedPrototypeData() {
  resetState();
  syncDataRefs();
  renderStoresTable();
  renderCustomersTable();
  renderCmsNav();
  renderCmsContent();
  updateTopStats();
  showToast('已重置全站預設測試資料', { variant: 'success', position: 'bottom-right' });
}

/* --------------------------------------------------------------------------
   事件
   -------------------------------------------------------------------------- */
function bindActions() {
  delegateActions({
    'switch-tab': (el) => switchMainTab(el.dataset.tab),
    'toggle-store-sound': (el) => toggleStoreSound(el.dataset.index),
    'toggle-store-active': (el) => toggleStoreActive(el.dataset.index),
    'toggle-blacklist': (el) => toggleCustomerBlacklist(el.dataset.index),
    'record-abandon': (el) => recordAbandon(el.dataset.index),
    'jump-to-order': (el) => jumpToOrder(el.dataset.orderId),
    'switch-cms-doc': (el) => switchCmsDoc(el.dataset.index),
    'cms-toggle-edit': () => toggleCmsEdit(),
    'cms-cancel': () => cancelCmsEdit(),
    'reset-prototype': () => resetSharedPrototypeData()
  });
}

/* --------------------------------------------------------------------------
   初始化
   -------------------------------------------------------------------------- */
function initController() {
  syncDataRefs();
  bindActions();
  renderStoresTable();
  renderCustomersTable();
  renderCmsNav();
  renderCmsContent();
  updateTopStats();
  switchMainTab('stores');
  refreshIcons();

  // 跨分頁即時監聽：前台顧客下新訂單時，後台顧客訂單列表自動更新
  subscribe(() => {
    syncDataRefs();
    renderStoresTable();
    renderCustomersTable();
    if (!isEditingCms) {
      renderCmsNav();
      renderCmsContent();
    }
    updateTopStats();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initController);
} else {
  initController();
}
