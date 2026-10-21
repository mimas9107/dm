/* ==========================================================================
   來電送 CALL & DELIVER — Tailwind 主題設定
   --------------------------------------------------------------------------
   ⚠️ 必須以「傳統 script」載入，不可改成 type="module"。

   原因：Tailwind Play CDN 透過 window.tailwind.config 的 setter 觸發
   CSS 重新產生。若改為 module，該檔會被 defer 到 DOM 解析完畢後才執行，
   設定將晚於 Tailwind 首次產檔，導致 brick 主題色未生效（FOUC）。

   載入位置必須緊接在 Tailwind CDN 之後：
     <script src="https://cdn.tailwindcss.com"></script>
     <script src="./js/core/tailwind-config.js"></script>
   ========================================================================== */

tailwind.config = {
  theme: {
    extend: {
      colors: {
        brick: {
          DEFAULT: '#C84B31',
          dark: '#A53B24',
          light: '#FDF4F2'
        }
      },
      fontFamily: {
        sans: ['"Noto Sans TC"', 'sans-serif']
      }
    }
  }
};
