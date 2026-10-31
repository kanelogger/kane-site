/* Core content and navigation work without JS. */
import { initHeroPortrait } from './workshop-hero.js';

let cleanup;

function initWorkshop() {
  cleanup?.();
  cleanup = undefined;
  const panel = document.querySelector('.palette-panel');
  if (!panel) return;
  const controller = new AbortController();
  const { signal } = controller;
  const cleanupHero = initHeroPortrait();
  let frame;
  cleanup = () => {
    controller.abort();
    cleanupHero();
    if (frame !== undefined) cancelAnimationFrame(frame);
  };
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('[data-theme]')];
  const palettes = new Map(buttons.map((button) => [button.dataset.theme, button.textContent.trim()]));
  const applyPalette = (palette) => {
    if (!palettes.has(palette)) return;
    root.dataset.palette = palette;
    buttons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.theme === palette)));
    document.querySelector('.palette-status').textContent = `${panel.dataset.currentLabel}${palettes.get(palette)}`;
    document.querySelector('meta[name="theme-color"]').content = getComputedStyle(document.querySelector('.hero')).backgroundColor;
    try { localStorage.setItem('kane-workshop-palette', palette); } catch { /* Storage is optional. */ }
  };
  try { applyPalette(localStorage.getItem('kane-workshop-palette') || 'garden'); } catch { /* Keep default. */ }
  panel.hidden = false;
  buttons.forEach((button) => button.addEventListener('click', () => applyPalette(button.dataset.theme), { signal }));
  document.querySelector('.palette-reset').addEventListener('click', () => applyPalette('garden'), { signal });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.open) {
      panel.open = false;
      panel.querySelector('summary').focus();
    }
  }, { signal });
  const header = document.querySelector('.site-header');
  const sections = [...document.querySelectorAll('[data-section-tone]')];
  const navLinks = [...document.querySelectorAll('nav a')];
  const updateSection = () => {
    const marker = Math.max(
      header.getBoundingClientRect().bottom + 12,
      parseFloat(getComputedStyle(root).scrollPaddingTop) + 1,
    );
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
    frame = requestAnimationFrame(() => { updateSection(); scheduled = false; frame = undefined; });
  }, { passive: true, signal });
  window.addEventListener('resize', updateSection, { signal });
  window.addEventListener('pageshow', updateSection, { signal });
  updateSection();
}

document.addEventListener('astro:before-swap', () => { cleanup?.(); cleanup = undefined; });
document.addEventListener('astro:page-load', initWorkshop);
initWorkshop();
