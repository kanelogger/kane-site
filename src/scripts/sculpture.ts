import type { SceneTheme, SculptureScene } from './sculpture-types';

const testing = import.meta.env.PUBLIC_SCENE_TESTING === '1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let generation = 0;
let current: SculptureScene | undefined;
let currentRecord: MountRecord | undefined;
let nextGate = 0;
let queuedGate: number | undefined;
const gates = new Map<number, { promise: Promise<void>; release: () => void }>();
interface MountRecord {
  generation: number;
  status: string;
  created: number;
  destroyed: number;
  scene?: SculptureScene;
}
const records: MountRecord[] = [];

function invalidate() {
  generation++;
  if (current) {
    current.dispose();
    if (currentRecord) {
      currentRecord.destroyed++;
      currentRecord.status = 'disposed';
    }
  } else if (currentRecord?.status === 'loading') {
    currentRecord.status = 'invalidated';
  }
  current = undefined;
  currentRecord = undefined;
}

async function mount() {
  invalidate();
  const host = document.querySelector<HTMLElement>('[data-sculpture]');
  if (!host) return;
  host.dataset.sceneStatus = 'poster';
  if (reducedMotion.matches) return;

  const ownGeneration = generation;
  const record: MountRecord = { generation: ownGeneration, status: 'loading', created: 0, destroyed: 0 };
  if (testing) records.push(record);
  currentRecord = record;
  const gateId = testing ? queuedGate : undefined;
  queuedGate = undefined;
  const isCurrent = () => generation === ownGeneration && host.isConnected && !reducedMotion.matches;

  try {
    if (!isCurrent()) return;
    const { createSculpture } = await import('./sculpture-scene');
    // The test gate controls mount continuations even when import() shares a cached promise.
    if (gateId !== undefined) {
      await gates.get(gateId)?.promise;
      gates.delete(gateId);
    }
    if (!isCurrent()) { record.status = 'stale'; return; }
    const scene = createSculpture(host, isCurrent);
    if (!isCurrent()) { scene.dispose(); record.status = 'stale'; return; }
    current = scene;
    record.scene = scene;
    record.created++;
    record.status = 'mounted';
  } catch {
    record.status = isCurrent() ? 'fallback' : 'stale';
    if (isCurrent()) host.dataset.sceneStatus = 'poster';
  }
}

document.addEventListener('astro:before-swap', invalidate);
document.addEventListener('astro:page-load', mount);
reducedMotion.addEventListener('change', mount);

if (testing) {
  const api = Object.freeze({
    snapshot: () => ({
      generation,
      activeInstances: current ? 1 : 0,
      created: records.reduce((sum, record) => sum + record.created, 0),
      destroyed: records.reduce((sum, record) => sum + record.destroyed, 0),
      generations: records.map(({ scene, ...record }) => ({ ...record, ...scene?.snapshot() })),
      waiting: [...gates.keys()],
    }),
    deferNextMount: () => {
      const id = ++nextGate;
      let release!: () => void;
      const promise = new Promise<void>((resolve) => { release = resolve; });
      gates.set(id, { promise, release });
      queuedGate = id;
      return id;
    },
    release: (id: number) => { gates.get(id)?.release(); },
    capturePoster: (theme?: SceneTheme) => current?.capturePoster(theme),
    forceContextLoss: () => current?.forceContextLoss(),
    restoreContext: () => current?.restoreContext(),
  });
  Object.defineProperty(window, '__kaneSceneTest', { value: api, configurable: true });
}
