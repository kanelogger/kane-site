// Astro disables Vite's manifest during its multi-environment build. Capture
// the final client chunk graph directly, without exposing machine paths.
export default function sceneManifest() {
  return {
    name: 'kane-scene-manifest',
    apply: 'build',
    applyToEnvironment(environment) { return environment.name === 'client'; },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const manifest = Object.fromEntries(Object.values(bundle)
          .filter((output) => output.type === 'chunk')
          .map((chunk) => [chunk.fileName, {
            file: chunk.fileName,
            ...(chunk.facadeModuleId?.replaceAll('\\', '/').endsWith('/sculpture-scene.ts')
              ? { src: 'src/scripts/sculpture-scene.ts' } : {}),
            imports: chunk.imports,
            dynamicImports: chunk.dynamicImports,
          }]));
        this.emitFile({
          type: 'asset',
          fileName: '_astro/scene-manifest.json',
          source: JSON.stringify(manifest, null, 2),
        });
      },
    },
  };
}
