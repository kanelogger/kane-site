import { ART_ROTATION, createFilaments, filamentColor, createProjector } from '../lib/entrance-art';

let cleanup: (() => void) | undefined;

function initEntrance() {
  cleanup?.();
  const candidate = document.querySelector<HTMLDialogElement>('[data-entrance]');
  if (!candidate) return;
  const dialog = candidate;
  const canvas = dialog.querySelector<HTMLCanvasElement>('[data-entrance-canvas]')!;
  const motionButton = dialog.querySelector<HTMLButtonElement>('[data-entrance-motion]')!;
  const replay = document.querySelector<HTMLButtonElement>('[data-entrance-replay]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const pointer = matchMedia('(hover: hover) and (pointer: fine)');
  const abort = new AbortController();
  const { signal } = abort;
  const animations = new Set<Animation>();
  let context: CanvasRenderingContext2D | null = null;
  let frame = 0;
  let start = 0;
  let lastTime = 0;
  let paused = false;
  let closing = false;
  let replaying = false;
  let previousFocus: HTMLElement | null = null;
  let x = 0;
  let y = 0;
  let targetX = 0;
  let targetY = 0;
  let release = 0;
  let finishTimer: ReturnType<typeof setTimeout> | undefined;
  let strands: ReturnType<typeof createFilaments> = [];
  let colors: string[] = [];

  const announce = () => document.dispatchEvent(new Event('kane:entrance-change'));
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };
  const cancelAnimations = () => { animations.forEach((animation) => animation.cancel()); animations.clear(); };
  const animate = (element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
    const animation = element.animate(keyframes, options);
    animations.add(animation);
    animation.addEventListener('finish', () => {
      // Exit animations retain their final frame until finish() cancels them.
      // Dropping them here would leave the dialog translated offscreen on replay.
      if (options.fill !== 'forwards' && options.fill !== 'both') {
        animation.cancel();
        animations.delete(animation);
      }
    }, { once: true });
  };
  const requestDraw = () => {
    if (!frame && context && dialog.open && !paused && !reduced.matches && !document.hidden) frame = requestAnimationFrame(draw);
  };
  function draw(time: number) {
    frame = 0;
    if (!context || !dialog.open || paused || reduced.matches || document.hidden) return;
    const delta = Math.min((time - (lastTime || time)) / 16.67, 3);
    lastTime = time;
    const elapsed = (time - start) / 1000;
    const settle = Math.max(0, 1 - elapsed / 3.6);
    x += (targetX - x) * (1 - Math.pow(0.89, delta));
    y += (targetY - y) * (1 - Math.pow(0.89, delta));
    if (closing) release = Math.min(1, release + delta / 32);
    const rx = ART_ROTATION.x + y * 0.22 + settle * settle * 0.28;
    const ry = ART_ROTATION.y + x * 0.32 + release * 0.65;
    const rz = ART_ROTATION.z + settle * 0.1 - release * 0.4;
    const project = createProjector(rx, ry, rz, 1 - release * 0.28);
    context.clearRect(0, 0, 1000, 1000);
    context.lineWidth = 1.1;
    context.globalAlpha = 1 - release * 0.25;
    for (let index = 0; index < strands.length; index++) {
      context.beginPath();
      for (let step = 0; step < strands[index].length; step++) {
        const [px, py] = project(strands[index][step]);
        if (step === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.strokeStyle = colors[index];
      context.stroke();
    }
    dialog.dataset.artReady = '';
    if (settle > 0 || closing || Math.abs(targetX - x) > 0.001 || Math.abs(targetY - y) > 0.001) requestDraw();
  }
  const resize = () => {
    const size = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 1.5)));
    canvas.width = size;
    canvas.height = size;
    context?.setTransform(size / 1000, 0, 0, size / 1000, 0, 0);
    // Paused artwork must survive a backing-store resize without starting motion.
    if (paused || reduced.matches) delete dialog.dataset.artReady;
    else requestDraw();
  };
  const finish = (focus = true) => {
    clearTimeout(finishTimer);
    stop();
    cancelAnimations();
    dialog.close();
    dialog.style.removeProperty('transform');
    closing = false;
    announce();
    if (focus) {
      const target = replaying ? previousFocus : document.getElementById('hero-title');
      target?.focus({ preventScroll: true });
    }
  };
  const enter = (immediate = false) => {
    if (closing || !dialog.open) return;
    if (immediate || reduced.matches || paused) { finish(); return; }
    closing = true;
    // Entry is available immediately; the only delay is this cancellable exit.
    animate(dialog.querySelector('.entrance-bottom')!, [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: 240, fill: 'forwards' });
    animate(dialog, [{ transform: 'translateY(0)' }, { transform: 'translateY(-102%)' }], { duration: 760, delay: 120, easing: 'cubic-bezier(.76,0,.24,1)', fill: 'forwards' });
    requestDraw();
    finishTimer = setTimeout(() => finish(), 900);
  };
  const open = () => {
    if (!dialog.open) dialog.showModal();
    closing = false;
    release = 0;
    x = y = targetX = targetY = 0;
    start = performance.now();
    lastTime = 0;
    announce();
    if (reduced.matches) return;
    if (!context) {
      try { context = canvas.getContext('2d'); } catch { /* SVG remains visible. */ }
    }
    if (context && !strands.length) {
      strands = createFilaments(matchMedia('(max-width: 599px)').matches ? 48 : 64, 180);
      colors = strands.map((_, index) => filamentColor(index, strands.length));
    }
    resize();
    motionButton.hidden = !context;
    if (!paused) {
      dialog.querySelectorAll('.entrance-wordmark > span').forEach((letter, index) => {
        animate(letter, [{ transform: 'translateY(32%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 850, delay: index * 65, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'backwards' });
      });
      animate(dialog.querySelector('.entrance-art')!, [{ opacity: 0 }, { opacity: 1 }], { duration: 1100, delay: 100, fill: 'backwards' });
      animate(dialog.querySelector('.entrance-copy')!, [{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 650, delay: 250, fill: 'backwards' });
    }
    requestDraw();
  };
  const setMotionState = () => {
    motionButton.setAttribute('aria-pressed', String(paused));
    motionButton.querySelector('[data-entrance-motion-label]')!.textContent = (paused ? motionButton.dataset.playLabel : motionButton.dataset.pauseLabel)!;
    motionButton.querySelector('.entrance-motion-symbol')!.textContent = paused ? '▷' : 'Ⅱ';
  };
  dialog.dataset.enhanced = 'true';
  dialog.addEventListener('click', (event) => {
    const target = (event.target as Element).closest<HTMLElement>('[data-entrance-enter]');
    if (target) enter(target.hasAttribute('data-entrance-skip'));
  }, { signal });
  dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(); }, { signal });
  dialog.addEventListener('close', () => { stop(); announce(); }, { signal });
  dialog.addEventListener('pointermove', (event) => {
    if (!pointer.matches || closing || paused || reduced.matches) return;
    targetX = (event.clientX / innerWidth - 0.5) * 2;
    targetY = (event.clientY / innerHeight - 0.5) * 2;
    requestDraw();
  }, { signal, passive: true });
  dialog.addEventListener('pointerleave', () => { targetX = targetY = 0; requestDraw(); }, { signal });
  motionButton.addEventListener('click', () => {
    paused = !paused;
    setMotionState();
    if (paused) { stop(); cancelAnimations(); }
    else { lastTime = 0; requestDraw(); }
  }, { signal });
  reduced.addEventListener('change', () => {
    stop();
    cancelAnimations();
    if (closing) finish();
    if (reduced.matches) {
      delete dialog.dataset.artReady;
      motionButton.hidden = true;
    } else if (dialog.open) {
      open();
    }
  }, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stop(); if (closing) finish(false); }
    else { lastTime = 0; requestDraw(); }
  }, { signal });
  window.addEventListener('pagehide', () => { if (dialog.open) finish(false); }, { signal });
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  if (replay) {
    replay.hidden = false;
    replay.addEventListener('click', () => {
      previousFocus = document.activeElement as HTMLElement;
      replaying = true;
      open();
    }, { signal });
  }
  if (dialog.open) open();
  cleanup = () => {
    abort.abort();
    observer.disconnect();
    clearTimeout(finishTimer);
    stop();
    cancelAnimations();
    dialog.close();
    delete dialog.dataset.enhanced;
    cleanup = undefined;
  };
}

document.addEventListener('astro:page-load', initEntrance);
document.addEventListener('astro:before-swap', () => cleanup?.());
