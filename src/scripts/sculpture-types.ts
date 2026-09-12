export type SceneTheme = 'light' | 'dark';

export interface SceneState {
  frames: number;
  visible: boolean;
  background: boolean;
  pending: boolean;
  contextLost: boolean;
  calls: number;
  triangles: number;
}

export interface SculptureScene {
  snapshot(): SceneState;
  dispose(): void;
  capturePoster(theme?: SceneTheme): string;
  forceContextLoss(): void;
  restoreContext(): void;
}
