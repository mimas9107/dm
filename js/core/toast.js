/* ==========================================================================
   共用提示元件 (Toast)
   --------------------------------------------------------------------------
   原本 index.html 與 controller.html 各有一份實作，僅外觀位置不同：
     · 首頁    → 置頂置中、琥珀色警示三角（showToastWarning）
     · 主控台  → 置右下、綠色成功圓勾（showToast）
   現統一於此模組，以 variant / position 參數保留兩種外觀。
   ========================================================================== */

import { refreshIcons } from './dom.js';

const ICONS = {
  info: 'alert-triangle',
  warning: 'alert-triangle',
  success: 'check-circle-2'
};

const ICON_COLORS = {
  info: 'text-amber-400',
  warning: 'text-amber-400',
  success: 'text-emerald-400'
};

const POSITIONS = {
  'top-center': 'fixed top-20 left-1/2 -translate-x-1/2 z-50',
  'bottom-right': 'fixed bottom-6 right-6 z-50'
};

/**
 * 顯示一個輕量提示訊息。
 *
 * @param {string} message 提示文字
 * @param {{ variant?: 'info'|'warning'|'success', position?: 'top-center'|'bottom-right', duration?: number }} [options]
 */
export function showToast(message, options = {}) {
  const {
    variant = 'info',
    position = 'top-center',
    duration = 2200
  } = options;

  const toast = document.createElement('div');
  toast.className = `${POSITIONS[position] || POSITIONS['top-center']} bg-stone-900/95 text-white text-xs font-bold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 transition-all duration-300`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const icon = ICONS[variant] || ICONS.info;
  const color = ICON_COLORS[variant] || ICON_COLORS.info;

  const iconEl = document.createElement('i');
  iconEl.dataset.lucide = icon;
  iconEl.className = `w-4 h-4 shrink-0 ${color}`;

  const textEl = document.createElement('span');
  textEl.textContent = message;

  toast.appendChild(iconEl);
  toast.appendChild(textEl);
  document.body.appendChild(toast);

  refreshIcons();

  setTimeout(() => {
    toast.classList.add('opacity-0');
    if (position === 'bottom-right') {
      toast.classList.add('translate-y-2');
    } else {
      toast.classList.add('-translate-y-2');
    }
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
