type ThemePreference = 'system' | 'light' | 'dark';
type Theme = 'light' | 'dark';
export {};
declare global {
  interface Window { __kaneTheme?: { preference: ThemePreference; theme: Theme }; }
}
const system = matchMedia('(prefers-color-scheme: dark)');
const valid = (value: unknown): ThemePreference => value === 'light' || value === 'dark' ? value : 'system';
let preference = valid(window.__kaneTheme?.preference);

function apply(target: Document = document) {
  const theme: Theme = preference === 'system' ? (system.matches ? 'dark' : 'light') : preference;
  window.__kaneTheme = { preference, theme };
  target.documentElement.dataset.theme = theme;
  target.documentElement.style.colorScheme = theme;
  const themeColor = target.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  themeColor?.setAttribute('content', theme === 'dark' ? themeColor.dataset.darkColor ?? '#101917' : themeColor.dataset.lightColor ?? '#f8f5ec');
  target.querySelectorAll<HTMLSelectElement>('[data-theme-control]').forEach(select => {
    select.value = preference;
    select.closest<HTMLElement>('[data-theme-picker]')?.removeAttribute('hidden');
  });
  if (target === document) document.dispatchEvent(new CustomEvent('kane:theme-change', { detail: { theme } }));
}

document.addEventListener('change', event => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement) || !target.matches('[data-theme-control]')) return;
  preference = valid(target.value);
  try { localStorage.setItem('kane-theme', preference); } catch { /* The in-memory preference remains usable. */ }
  apply();
});
system.addEventListener('change', () => { if (preference === 'system') apply(); });
window.addEventListener('storage', event => {
  if (event.key !== 'kane-theme' && event.key !== null) return;
  preference = valid(event.newValue);
  apply();
});
document.addEventListener('astro:before-swap', event => apply(event.newDocument));
document.addEventListener('astro:page-load', () => apply());
apply();
