import {
  ACESFilmicToneMapping,
  BufferGeometry,
  DirectionalLight,
  EdgesGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  GridHelper,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Shape,
  SRGBColorSpace,
  WebGLRenderer,
  type Material,
} from 'three';
import type { SceneTheme, SculptureScene } from './sculpture-types';

export function createSculpture(host: HTMLElement, isCurrent: () => boolean): SculptureScene {
  const stage = host.querySelector<HTMLElement>('[data-sculpture-stage]')!;
  const controls = host.querySelector<HTMLElement>('[data-sculpture-controls]')!;
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  // Request WebGL2 before constructing Three: unsupported browsers keep the HTML poster.
  const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
  if (!context || !isCurrent()) throw new Error('Scene unavailable');
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  } catch (error) {
    context.getExtension('WEBGL_lose_context')?.loseContext();
    throw error;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setPixelRatio(1);
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const cleanups: (() => void)[] = [];
  let pending = 0;
  let resized: ResizeObserver | undefined;
  let intersection: IntersectionObserver | undefined;

  function releaseResources() {
    cancelAnimationFrame(pending);
    pending = 0;
    resized?.disconnect();
    intersection?.disconnect();
    cleanups.forEach((cleanup) => cleanup());
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
    controls.hidden = true;
    host.dataset.sceneStatus = 'poster';
  }

  try {
    const scene = new Scene();
    const camera = new PerspectiveCamera(32, 1, .1, 30);
    camera.position.set(0, .12, 8.1);
    const sculpture = new Group();
    scene.add(sculpture);
    scene.add(new HemisphereLight(0xeafff0, 0x3b5645, 2.4));
    const key = new DirectionalLight(0xe6fff1, 3);
    key.position.set(-3, 5, 5);
    scene.add(key);
    const fill = new DirectionalLight(0xffffff, 1.5);
    fill.position.set(4, -1, 3);
    scene.add(fill);
    const surfaces: MeshStandardMaterial[] = [];
    const outlines: LineBasicMaterial[] = [];
    const hatches: LineBasicMaterial[] = [];
    const shapes: [number, number][][] = [
      [[-1.08, -1.45], [-.5, -1.45], [-.5, 1.45], [-1.08, 1.45]],
      [[-.41, -.01], [.15, .06], [1.25, 1.45], [.56, 1.45]],
      [[-.35, -.08], [.13, .3], [1.3, -1.45], [.56, -1.45]],
    ];

    const pieces = shapes.map((points) => {
      const shape = new Shape();
      points.forEach(([x, y], i) => { if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y); });
      shape.closePath();
      const geometry = new ExtrudeGeometry(shape, {
        depth: .48, bevelEnabled: true, bevelSize: .018, bevelThickness: .023,
        bevelSegments: 1, steps: 1, curveSegments: 1,
      });
      geometry.translate(-.05, 0, -.24);
      geometries.add(geometry);
      const surface = new MeshStandardMaterial({
        color: 0x4f7c62, metalness: .35, roughness: .38,
        transparent: true, opacity: .1, depthWrite: false,
      });
      surfaces.push(surface);
      materials.add(surface);
      const mesh = new Mesh(geometry, surface);
      sculpture.add(mesh);

      const edges = new EdgesGeometry(geometry, 28);
      geometries.add(edges);
      const outline = new LineBasicMaterial({ color: 0x30674b, transparent: true, opacity: .9 });
      materials.add(outline);
      outlines.push(outline);
      mesh.add(new LineSegments(edges, outline));

      // Cross-sections describe each individual extruded part, including its front and back.
      const vertices: number[] = [];
      for (let i = 1; i < 13; i++) {
        const t = i / 13;
        const a = [points[0][0] + (points[3][0] - points[0][0]) * t - .05, points[0][1] + (points[3][1] - points[0][1]) * t];
        const b = [points[1][0] + (points[2][0] - points[1][0]) * t - .05, points[1][1] + (points[2][1] - points[1][1]) * t];
        vertices.push(a[0], a[1], .265, b[0], b[1], .265, a[0], a[1], -.265, b[0], b[1], -.265);
      }
      const hatchGeometry = new BufferGeometry();
      hatchGeometry.setAttribute('position', new Float32BufferAttribute(vertices, 3));
      geometries.add(hatchGeometry);
      const hatch = new LineBasicMaterial({ color: 0x30674b, transparent: true, opacity: .2, depthWrite: false });
      materials.add(hatch);
      hatches.push(hatch);
      mesh.add(new LineSegments(hatchGeometry, hatch));
      return mesh;
    });
    const grid = new GridHelper(6.6, 22, 0xffffff, 0xffffff);
    grid.position.y = -1.72;
    grid.material.transparent = true;
    grid.material.opacity = .21;
    scene.add(grid);
    geometries.add(grid.geometry);
    materials.add(grid.material);
    stage.append(canvas);

    let disposed = false;
    let contextLost = false;
    let visible = false;
    let frames = 0;
    let calls = 0;
    let triangles = 0;
    let lastTime = 0;
    let theme: SceneTheme = 'light';
    let explosion = .65;
    let targetExplosion = 0;
    let yaw = -.25;
    let targetYaw = 0;
    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;
    let solid = 0;
    let targetSolid = 0;
    const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

    function readTheme(): SceneTheme {
      return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    }
    function applyTheme(next = readTheme()) {
      theme = next;
      const dark = theme === 'dark';
      outlines.forEach((material) => material.color.setHex(dark ? 0xa1dbb5 : 0x285b40));
      hatches.forEach((material) => material.color.setHex(dark ? 0x94cba7 : 0x285b40));
      surfaces.forEach((material, i) => material.color.setHex((dark ? [0x6b9d7e, 0x89b998, 0x567e66] : [0x427352, 0x5c916e, 0x385d46])[i]));
      grid.material.color.setHex(dark ? 0x75aa87 : 0x48715a);
      grid.material.opacity = dark ? .23 : .2;
    }
    function setPose() {
      pieces[0].position.set(-explosion * .5, 0, 0);
      pieces[1].position.set(explosion * .43, explosion * .4, explosion * .18);
      pieces[2].position.set(explosion * .49, -explosion * .36, -explosion * .12);
      sculpture.rotation.set(.1 + pointerY * .1, -.33 + yaw + pointerX * .28, -.025);
      surfaces.forEach((material) => { material.opacity = .1 + solid * .86; });
      hatches.forEach((material) => { material.opacity = .2 * (1 - solid); });
      outlines.forEach((material) => { material.opacity = .9 - solid * .32; });
    }
    function measure() {
      const { width, height } = stage.getBoundingClientRect();
      const mobile = matchMedia('(max-width: 699px)').matches;
      const pixelCap = mobile ? 600_000 : 1_500_000;
      const dpr = Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.5, Math.sqrt(pixelCap / Math.max(1, width * height)));
      renderer.setSize(Math.max(1, Math.floor(width * dpr)), Math.max(1, Math.floor(height * dpr)), false);
      camera.aspect = width / Math.max(1, height);
      camera.position.z = camera.aspect < .85 ? 8.7 : 8.1;
      camera.updateProjectionMatrix();
    }
    function active() {
      return !disposed && !contextLost && isCurrent() && visible && !document.hidden && stage.offsetWidth > 0;
    }
    function stop() { cancelAnimationFrame(pending); pending = 0; lastTime = 0; }
    function schedule() {
      if (active() && !pending) {
        if (!lastTime) lastTime = performance.now();
        pending = requestAnimationFrame(render);
      }
    }
    function approach(value: number, target: number, amount: number) {
      const next = value + (target - value) * amount;
      return Math.abs(target - next) < .002 ? target : next;
    }
    function paint() {
      renderer.render(scene, camera);
      frames++;
      calls = renderer.info.render.calls;
      triangles = renderer.info.render.triangles;
      // The poster remains visible until a real frame has completed successfully.
      canvas.hidden = false;
      controls.hidden = false;
      host.dataset.sceneStatus = 'ready';
    }
    function showPoster() {
      stop();
      canvas.hidden = true;
      controls.hidden = true;
      host.dataset.sceneStatus = contextLost ? 'context-lost' : 'poster';
    }
    function render(time: number) {
      pending = 0;
      if (!active()) return;
      const delta = Math.max(0, time - lastTime);
      lastTime = time;
      const amount = 1 - Math.exp(-delta / 90);
      explosion = approach(explosion, targetExplosion, amount);
      yaw = approach(yaw, targetYaw, amount);
      pointerX = approach(pointerX, targetPointerX, amount);
      pointerY = approach(pointerY, targetPointerY, amount);
      solid = approach(solid, targetSolid, amount);
      setPose();
      try { paint(); } catch { contextLost = true; showPoster(); return; }
      if (explosion !== targetExplosion || yaw !== targetYaw || pointerX !== targetPointerX || pointerY !== targetPointerY || solid !== targetSolid) schedule();
      else lastTime = 0;
    }

    host.querySelectorAll<HTMLButtonElement>('[data-sculpture-action]').forEach((button) => {
      // A motion preference change may remount the scene into the same HTML controls.
      if (button.dataset.sculptureAction === 'explode' || button.dataset.sculptureAction === 'solid') {
        button.textContent = button.dataset.sculptureAction === 'explode' ? '拆解 K' : '显示实体';
        button.setAttribute('aria-pressed', 'false');
      }
      const click = () => {
        if (button.dataset.sculptureAction === 'explode') {
          targetExplosion = targetExplosion ? 0 : 1;
          button.textContent = targetExplosion ? '重组 K' : '拆解 K';
          button.setAttribute('aria-pressed', String(Boolean(targetExplosion)));
        } else if (button.dataset.sculptureAction === 'solid') {
          targetSolid = targetSolid ? 0 : 1;
          button.textContent = targetSolid ? '显示线框' : '显示实体';
          button.setAttribute('aria-pressed', String(Boolean(targetSolid)));
        } else {
          targetYaw += Math.PI * .5;
        }
        schedule();
      };
      button.addEventListener('click', click);
      cleanups.push(() => button.removeEventListener('click', click));
    });
    const pointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || !finePointer.matches) return;
      const bounds = stage.getBoundingClientRect();
      targetPointerX = Math.max(-.5, Math.min(.5, (event.clientX - bounds.left) / bounds.width - .5));
      targetPointerY = Math.max(-.5, Math.min(.5, (event.clientY - bounds.top) / bounds.height - .5));
      schedule();
    };
    const leave = () => { targetPointerX = 0; targetPointerY = 0; schedule(); };
    stage.addEventListener('pointermove', pointer);
    stage.addEventListener('pointerleave', leave);
    cleanups.push(() => { stage.removeEventListener('pointermove', pointer); stage.removeEventListener('pointerleave', leave); });
    resized = new ResizeObserver(() => { if (disposed || !isCurrent()) return; measure(); schedule(); });
    resized.observe(stage);
    intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule(); else stop();
    }, { threshold: .01 });
    intersection.observe(stage);
    const visibility = () => { if (document.hidden) stop(); else schedule(); };
    const themeChanged = () => { if (!disposed) { applyTheme(); schedule(); } };
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('kane:theme-change', themeChanged);
    cleanups.push(() => {
      document.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('kane:theme-change', themeChanged);
    });
    const lost = (event: Event) => { event.preventDefault(); contextLost = true; showPoster(); };
    const restored = () => {
      if (disposed || !isCurrent()) return;
      contextLost = false;
      measure();
      applyTheme();
      schedule();
    };
    canvas.addEventListener('webglcontextlost', lost);
    canvas.addEventListener('webglcontextrestored', restored);
    cleanups.push(() => { canvas.removeEventListener('webglcontextlost', lost); canvas.removeEventListener('webglcontextrestored', restored); });
    measure();
    applyTheme();
    setPose();

    return {
      snapshot: () => ({ frames, visible, background: document.hidden, pending: Boolean(pending), contextLost, calls, triangles }),
      capturePoster(posterTheme = theme) {
        if (!active()) throw new Error('Poster capture requires a visible active scene');
        const saved = { explosion, yaw, pointerX, pointerY, solid };
        explosion = yaw = pointerX = pointerY = solid = 0;
        renderer.setSize(1200, 1200, false);
        camera.aspect = 1;
        camera.position.z = 8.1;
        camera.updateProjectionMatrix();
        applyTheme(posterTheme);
        setPose();
        paint();
        const image = canvas.toDataURL('image/png');
        ({ explosion, yaw, pointerX, pointerY, solid } = saved);
        measure();
        applyTheme();
        setPose();
        schedule();
        return image;
      },
      forceContextLoss: () => renderer.forceContextLoss(),
      restoreContext: () => renderer.forceContextRestore(),
      dispose() {
        if (disposed) return;
        disposed = true;
        stop();
        releaseResources();
      },
    };
  } catch (error) {
    releaseResources();
    throw error;
  }
}
