/* Core content and navigation work without JS. */
import { initHeroPortrait } from './workshop-hero.js';

let cleanup;

function initWorkshop() {
  cleanup?.();
  cleanup = undefined;
  if (!document.querySelector('[data-workshop-home]')) return;
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
  const header = document.querySelector('.site-header');
  const sections = [...document.querySelectorAll('[data-section-tone]')];
  const navLinks = [...document.querySelectorAll('nav a')];
  const updateSection = () => {
    const marker = Math.max(
      header.getBoundingClientRect().bottom + 12,
      parseFloat(getComputedStyle(root).scrollPaddingTop) + 1,
    );
    // The final section may be too short to reach the header's scroll marker.
    const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight;
    const current = atBottom ? sections.at(-1) : [...sections].reverse().find((section) => section.getBoundingClientRect().top <= marker) || sections[0];
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
