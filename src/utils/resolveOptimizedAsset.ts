import manifest from '../assets/optimized-manifest.json';

const optimizedModules = import.meta.glob('../assets/**/*.{webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const originalModules = import.meta.glob('../assets/**/*.{jpg,JPG,jpeg,JPEG,png,PNG,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const manifestTyped = manifest as Record<string, string>;

function normalizeInputPath(input: string) {
  const trimmed = input.replace(/^\.\/?/, '');
  if (trimmed.startsWith('assets/')) {
    return trimmed.replace(/^assets\//, '');
  }
  return trimmed;
}

function toModuleKey(relative: string) {
  return `../assets/${relative}`;
}

export function resolveOptimizedAsset(relativePath: string) {
  const manifestKey = normalizeInputPath(relativePath);
  const optimizedRelative = manifestTyped[manifestKey];
  if (optimizedRelative) {
    const optimizedModule = optimizedModules[toModuleKey(optimizedRelative)];
    if (optimizedModule) {
      return optimizedModule as string;
    }
  }

  const originalModule = originalModules[toModuleKey(manifestKey)];
  if (!originalModule) {
    console.warn(`[asset-resolver] Missing asset for ${relativePath}`);
    return '';
  }
  return originalModule as string;
}

export function resolveOptimizedGallery(paths: readonly string[]) {
  return paths
    .map((path) => resolveOptimizedAsset(path))
    .filter((value): value is string => Boolean(value));
}
