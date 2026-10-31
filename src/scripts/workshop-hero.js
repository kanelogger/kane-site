/** Draw the host, carry him into the workshop, then let the CSS welcome pose settle. */
export function initHeroPortrait() {
  const hero = document.querySelector('.hero');
  const portrait = hero?.querySelector('.hero-avatar .hero-portrait');
  const redraw = hero?.querySelector('.hero-redraw');
  if (!hero || !portrait || !redraw) return () => {};
  const identity = hero.querySelector('.hero-identity');
  const scene = hero.querySelector('.hero-workshop');
  const image = scene?.querySelector('.scene-image');
  const destination = hero.querySelector('.mascot-face .hero-portrait');
  const drawings = [portrait, scene].filter(Boolean);
  const canTravel = Boolean(identity && scene && destination);

  const controller = new AbortController();
  const { signal } = controller;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const previousOriginHeight = hero.style.getPropertyValue('--origin-height');
  let drawingTimer;
  let flightFrame;
  let flight;
  let runVersion = 0;
  let ready = !scene;
  let decodeVersion = 0;
  let initialDrawingPending = true;

  const clearDrawing = () => {
    drawings.forEach((drawing) => drawing.removeAttribute('data-drawing'));
  };
  const cancelMotion = () => {
    runVersion += 1;
    window.clearTimeout(drawingTimer);
    if (flightFrame !== undefined) cancelAnimationFrame(flightFrame);
    flightFrame = undefined;
    flight?.remove();
    flight = undefined;
    clearDrawing();
  };
  const settle = (instant = true) => {
    cancelMotion();
    if (signal.aborted) return;
    if (ready && canTravel) {
      hero.toggleAttribute('data-mascot-instant', instant);
      hero.dataset.mascotState = 'welcome';
    } else {
      hero.removeAttribute('data-mascot-state');
      hero.removeAttribute('data-mascot-instant');
    }
  };
  const restoreOrigin = () => {
    hero.removeAttribute('data-mascot-instant');
    // The drawing state disables the collapsing transition, including on a mid-flight replay.
    hero.dataset.mascotState = 'drawing';
    if (!identity) return;
    const previousMaxHeight = identity.style.maxHeight;
    identity.style.maxHeight = 'none';
    hero.style.setProperty('--origin-height', `${Math.ceil(identity.getBoundingClientRect().height)}px`);
    identity.style.maxHeight = previousMaxHeight;
    identity.getBoundingClientRect();
  };
  const beginTravel = (version) => {
    if (signal.aborted || version !== runVersion) return;
    clearDrawing();
    if (!canTravel || reducedMotion.matches || document.hidden) {
      settle();
      return;
    }
    const from = portrait.getBoundingClientRect();
    if (!from.width || !from.height || from.bottom <= 0 || from.top >= window.innerHeight) {
      settle();
      return;
    }

    flight = portrait.cloneNode(true);
    flight.classList.add('hero-portrait-flight');
    flight.removeAttribute('aria-label');
    flight.removeAttribute('id');
    flight.setAttribute('aria-hidden', 'true');
    flight.setAttribute('focusable', 'false');
    flight.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
    Object.assign(flight.style, {
      position: 'fixed', left: '0', top: '0', margin: '0',
      width: `${from.width}px`, height: `${from.height}px`, maxWidth: 'none',
      pointerEvents: 'none', zIndex: '30', transformOrigin: '0 0',
      transform: `translate(${from.left}px, ${from.top}px)`, willChange: 'transform',
    });
    document.body.append(flight);
    hero.dataset.mascotState = 'travel';
    const started = performance.now();

    const tick = (now) => {
      if (signal.aborted || version !== runVersion) return;
      if (!destination.isConnected || document.hidden || reducedMotion.matches) {
        settle();
        return;
      }
      const progress = Math.min(1, (now - started) / 1000);
      const eased = 1 - (1 - progress) ** 3;
      // The scene can move while the introduction collapses; follow its live face rectangle.
      const to = destination.getBoundingClientRect();
      if (!to.width || !to.height) {
        settle();
        return;
      }
      const arc = Math.min(76, Math.max(28, Math.abs(to.left - from.left) * .12));
      const x = from.left + (to.left - from.left) * eased;
      const y = from.top + (to.top - from.top) * eased - Math.sin(Math.PI * eased) * arc;
      const scale = 1 + (to.width / from.width - 1) * eased;
      flight.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      if (progress < 1) flightFrame = requestAnimationFrame(tick);
      else settle(false);
    };
    flightFrame = requestAnimationFrame(tick);
  };
  const draw = () => {
    cancelMotion();
    if (signal.aborted || !ready) return;
    if (reducedMotion.matches || document.hidden) {
      settle();
      return;
    }
    restoreOrigin();
    drawings.forEach((drawing) => drawing.getBoundingClientRect());
    drawings.forEach((drawing) => drawing.setAttribute('data-drawing', ''));
    const version = runVersion;
    drawingTimer = window.setTimeout(() => beginTravel(version), 2850);
  };
  const updateMotion = () => {
    redraw.hidden = !ready || reducedMotion.matches;
    if (ready && reducedMotion.matches) settle();
  };
  const imageFailed = () => {
    if (signal.aborted) return;
    decodeVersion += 1;
    ready = false;
    settle();
    scene?.setAttribute('data-image-error', '');
    updateMotion();
  };
  const imageReady = () => {
    if (signal.aborted) return;
    ready = true;
    scene?.removeAttribute('data-image-error');
    updateMotion();
    if (!initialDrawingPending) return;
    initialDrawingPending = false;
    if (window.location.hash || performance.getEntriesByType('navigation')[0]?.type === 'back_forward') settle();
    else draw();
  };
  const decodeImage = async () => {
    const version = ++decodeVersion;
    ready = false;
    settle();
    updateMotion();
    try {
      await image.decode();
      if (signal.aborted || version !== decodeVersion) return;
      if (image.naturalWidth > 0) imageReady();
      else imageFailed();
    } catch {
      if (!signal.aborted && version === decodeVersion) imageFailed();
    }
  };

  redraw.addEventListener('click', draw, { signal });
  reducedMotion.addEventListener('change', updateMotion, { signal });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) settle();
  }, { signal });
  window.addEventListener('scroll', () => {
    if (hero.dataset.mascotState === 'travel') settle();
  }, { passive: true, signal });
  window.addEventListener('resize', () => {
    if (hero.dataset.mascotState === 'travel') settle();
    else if (identity && hero.dataset.mascotState === 'drawing') {
      hero.style.setProperty('--origin-height', `${identity.scrollHeight}px`);
    }
  }, { signal });
  updateMotion();
  if (!scene) {
    imageReady();
  } else if (!image) {
    imageFailed();
  } else {
    image.addEventListener('load', decodeImage, { signal });
    image.addEventListener('error', imageFailed, { signal });
    if (image.complete) {
      if (image.naturalWidth > 0) void decodeImage();
      else imageFailed();
    }
  }

  return () => {
    controller.abort();
    cancelMotion();
    hero.removeAttribute('data-mascot-state');
    hero.removeAttribute('data-mascot-instant');
    if (previousOriginHeight) hero.style.setProperty('--origin-height', previousOriginHeight);
    else hero.style.removeProperty('--origin-height');
    redraw.hidden = true;
  };
}
