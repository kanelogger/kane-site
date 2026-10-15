import { mkdirSync, writeFileSync } from 'node:fs';
import { staticFilaments } from '../src/lib/entrance-art.ts';

// Run with Node 24 after changing the parametric sculpture. The lightweight
// static poster is shared by both locales and works without canvas.
const paths = staticFilaments(40, 180).map(({ d, color }) => `<path d="${d}" stroke="${color}"/>`).join('');
mkdirSync('public/assets/brand', { recursive: true });
writeFileSync('public/assets/brand/entrance-filaments.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="none" stroke-width="1.3">${paths}</svg>\n`);
console.log('Generated original entrance filament poster.');
