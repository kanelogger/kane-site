import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
let media: ReturnType<typeof gsap.matchMedia> | undefined;

function initMotion() {
  media?.revert();
  media = gsap.matchMedia();
  media.add({
    motion: '(prefers-reduced-motion: no-preference)',
    hover: '(hover: hover) and (pointer: fine)',
  }, (context) => {
    if (!context.conditions?.motion) return;
    const cleanups: (() => void)[] = [];
    const intro = document.querySelectorAll('[data-intro]');
    if (intro.length) gsap.from(intro, {
      y: 24, opacity: 0, duration: 0.65, stagger: 0.08,
      ease: 'power2.out', clearProps: 'transform,opacity',
    });

    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((element) => {
      // Restored pages and anchor targets already above the viewport stay visible.
      if (element.getBoundingClientRect().top < 0) return;
      const animation = gsap.from(element, {
        y: 28, opacity: 0, duration: 0.65, ease: 'power2.out',
        clearProps: 'transform,opacity',
        scrollTrigger: { trigger: element, start: 'top 94%', once: true },
      });
      const revealOnFocus = () => animation.progress(1);
      element.addEventListener('focusin', revealOnFocus);
      cleanups.push(() => element.removeEventListener('focusin', revealOnFocus));
    });

    if (context.conditions.hover) {
      document.querySelectorAll<HTMLElement>('.project-image-link').forEach((link) => {
        const img = link.querySelector('img');
        if (!img) return;
        const zoom = gsap.to(img, { scale: 1.025, duration: 0.45, ease: 'power2.out', paused: true });
        const enter = () => { zoom.play(); };
        const leave = () => { zoom.reverse(); };
        link.addEventListener('mouseenter', enter);
        link.addEventListener('mouseleave', leave);
        cleanups.push(() => {
          link.removeEventListener('mouseenter', enter);
          link.removeEventListener('mouseleave', leave);
        });
      });
    }
    return () => cleanups.forEach((cleanup) => cleanup());
  });
}

document.addEventListener('astro:before-swap', () => {
  media?.revert();
  media = undefined;
});
document.addEventListener('astro:page-load', initMotion);
