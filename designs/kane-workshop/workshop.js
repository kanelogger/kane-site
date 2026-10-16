/* Optional prototype controls. Core content and navigation work without JS. */
(() => {
  const root = document.documentElement;
  const palettes = { garden: '鼠尾草', blue: '晴空蓝', paper: '暖纸白' };
  const panel = document.querySelector('.palette-panel');
  const buttons = [...document.querySelectorAll('[data-theme]')];
  const applyPalette = (palette) => {
    if (!Object.hasOwn(palettes, palette)) return;
    root.dataset.palette = palette;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === palette)));
    document.querySelector('.palette-status').textContent = `当前：${palettes[palette]}`;
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(root).getPropertyValue('--hero').trim();
    try { localStorage.setItem('kane-workshop-palette', palette); } catch { /* Storage is optional. */ }
  };
  try { applyPalette(localStorage.getItem('kane-workshop-palette') || 'garden'); } catch { /* Keep default. */ }
  panel.hidden = false;
  buttons.forEach((button) => button.addEventListener('click', () => applyPalette(button.dataset.theme)));
  document.querySelector('.palette-reset').addEventListener('click', () => applyPalette('garden'));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.open) {
      panel.open = false;
      panel.querySelector('summary').focus();
    }
  });
  const header = document.querySelector('.site-header');
  const sections = [...document.querySelectorAll('[data-section-tone]')];
  const navLinks = [...document.querySelectorAll('nav a')];
  const updateSection = () => {
    const marker = header.getBoundingClientRect().bottom + 12;
    const current = [...sections].reverse().find((section) => section.getBoundingClientRect().top <= marker) || sections[0];
    header.dataset.tone = current.dataset.sectionTone;
    navLinks.forEach((link) => {
      if (link.hash === `#${current.id}`) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  };
  let scheduled = false;
  window.addEventListener('scroll', () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { updateSection(); scheduled = false; });
  }, { passive: true });
  window.addEventListener('resize', updateSection);
  window.addEventListener('pageshow', updateSection);
  updateSection();
})();
