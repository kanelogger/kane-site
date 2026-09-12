import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
let media: ReturnType<typeof gsap.matchMedia> | undefined;

function initMotion() {
  media?.revert();
  media = undefined;
  const home = document.querySelector<HTMLElement>('[data-home]');
  if (!home) return;
  media = gsap.matchMedia();
  media.add({
    motion: '(prefers-reduced-motion: no-preference)',
    hover: '(hover: hover) and (pointer: fine)',
  }, (context) => {
    if (!context.conditions?.motion) return;
    const cleanups: (() => void)[] = [];
    const animations = new Map<HTMLElement, gsap.core.Tween>();
    const intro = [...home.querySelectorAll<HTMLElement>('[data-home-intro]')]
      .filter((element) => element.getBoundingClientRect().top >= 0);
    // Keep words readable from the first frame; movement adds the entrance.
    intro.forEach((element, index) => {
      animations.set(element, gsap.from(element, {
        y: 18, duration: 0.5, delay: index * 0.05,
        ease: 'power2.out', clearProps: 'transform',
      }));
    });

    home.querySelectorAll<HTMLElement>('[data-home-reveal], [data-reveal]').forEach((element) => {
      // Restored pages and anchor targets already above the viewport stay visible.
      if (element.getBoundingClientRect().top < 0) return;
      const animation = gsap.from(element, {
        y: 20, duration: 0.5, ease: 'power2.out',
        clearProps: 'transform',
        scrollTrigger: { trigger: element, start: 'top 94%', once: true },
      });
      animations.set(element, animation);
    });
    animations.forEach((animation, element) => {
      const revealOnFocus = () => {
        animation.progress(1);
        animation.scrollTrigger?.kill();
      };
      element.addEventListener('focusin', revealOnFocus);
      cleanups.push(() => element.removeEventListener('focusin', revealOnFocus));
    });
    const settleAnchor = (event: MouseEvent) => {
      const link = (event.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
      if (!link) return;
      const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
      if (!target) return;
      animations.forEach((animation, element) => {
        if (!target.contains(element) && !element.contains(target)) return;
        animation.progress(1);
        animation.scrollTrigger?.kill();
      });
    };
    home.addEventListener('click', settleAnchor);
    cleanups.push(() => home.removeEventListener('click', settleAnchor));

    if (context.conditions.hover) {
      home.querySelectorAll<HTMLElement>('.project-image-link').forEach((link) => {
        const img = link.querySelector('img');
        if (!img) return;
        const zoom = gsap.to(img, { scale: 1.015, duration: 0.3, ease: 'power2.out', paused: true });
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
