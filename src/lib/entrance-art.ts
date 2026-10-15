/** Original parametric filament sculpture. Shared by the SVG fallback and canvas. */
export type Point3 = readonly [number, number, number];
export const ART_ROTATION = { x: 0.35, y: -0.48, z: -0.32 };

export function createFilaments(count = 72, steps = 200): Point3[][] {
  return Array.from({ length: count }, (_, strand) => {
    const v = (strand / count) * Math.PI * 2;
    return Array.from({ length: steps + 1 }, (_, step) => {
      const u = (step / steps) * Math.PI * 2;
      const twist = v + u * 3;
      const radius = 1.25 + 0.48 * Math.cos(u * 3) + 0.18 * Math.cos(twist);
      return [
        radius * Math.cos(u * 2),
        radius * Math.sin(u * 2),
        0.65 * Math.sin(u * 3) + 0.18 * Math.sin(twist),
      ] as const;
    });
  });
}

export function createProjector(rx: number, ry: number, rz: number, scale = 1) {
  // Rotation is constant for a frame: compute six trig values once, not for
  // every vertex. This also keeps the SVG and interactive geometry identical.
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const cz = Math.cos(rz), sz = Math.sin(rz);
  return ([x, y, z]: Point3): Point3 => {
    const y1 = y * cx - z * sx;
    const z1 = y * sx + z * cx;
    const x2 = x * cy + z1 * sy;
    const z2 = -x * sy + z1 * cy;
    const x3 = x2 * cz - y1 * sz;
    const y3 = x2 * sz + y1 * cz;
    const perspective = 5 / (5 - z2);
    return [500 + x3 * 211 * perspective * scale, 500 + y3 * 211 * perspective * scale, z2];
  };
}

export function filamentColor(index: number, count: number): string {
  const light = 43 + 35 * Math.pow((Math.sin((index / count) * Math.PI * 2 - 0.8) + 1) / 2, 2);
  return `hsl(${15 + (light - 43) * 0.6} 91% ${light}%)`;
}

export function staticFilaments(count = 40, steps = 180) {
  const strands = createFilaments(count, steps);
  const project = createProjector(ART_ROTATION.x, ART_ROTATION.y, ART_ROTATION.z);
  return strands.map((points, index) => ({
    d: points.map((point, step) => {
      const [x, y] = project(point);
      return `${step ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(''),
    color: filamentColor(index, strands.length),
  }));
}
