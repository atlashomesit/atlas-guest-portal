#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { glob } from 'glob';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.resolve(projectRoot, 'src/assets/optimized-manifest.json');
const sizeCeilingBytes = 500 * 1024; // 500 KiB threshold for raw assets

const sourceGlobs = [
  'src/assets/**/*.{jpg,JPG,jpeg,JPEG,png,PNG}',
  'public/**/*.{jpg,JPG,jpeg,JPEG,png,PNG}'
];

const ignoreGlobs = ['**/*.webp'];

function normalizeKey(relativePath) {
  // e.g. src/assets/501/IMG_1.jpg -> 501/IMG_1.jpg
  return relativePath.replace(/^src\/assets\//, '');
}

async function ensureDirExists(filePath) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
}

async function removeOutdatedOptimizedFiles(dir, baseName, expectedFile) {
  const pattern = path.join(dir, `${baseName}.*.webp`);
  const matches = await glob(pattern, { absolute: true, nodir: true });
  await Promise.all(
    matches
      .filter((candidate) => path.resolve(candidate) !== path.resolve(expectedFile))
      .map((candidate) => fs.rm(candidate))
  );
}

async function writeManifest(manifest) {
  const sortedEntries = Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b));
  const json = JSON.stringify(Object.fromEntries(sortedEntries), null, 2);
  await ensureDirExists(manifestPath);
  await fs.writeFile(manifestPath, `${json}\n`, 'utf8');
}

async function main() {
  const files = await glob(sourceGlobs, {
    cwd: projectRoot,
    absolute: true,
    nodir: true,
    ignore: ignoreGlobs,
  });

  if (!files.length) {
    console.info('No source images found.');
    return;
  }

  const manifest = existsSync(manifestPath)
    ? JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    : {};

  const oversizedRaw = [];

  for (const file of files) {
    const relative = path.relative(projectRoot, file);
    const dir = path.dirname(file);
    const ext = path.extname(file);
    const baseName = path.basename(file, ext);

    const buffer = await fs.readFile(file);
    const hash = createHash('sha1').update(buffer).digest('hex').slice(0, 8);
    const optimizedName = `${baseName}.${hash}.webp`;
    const optimizedPath = path.join(dir, optimizedName);

    await removeOutdatedOptimizedFiles(dir, baseName, optimizedPath);

    if (!existsSync(optimizedPath)) {
      const pipeline = sharp(buffer).rotate();
      const webpBuffer = await pipeline.webp({ quality: 80 }).toBuffer();
      await fs.writeFile(optimizedPath, webpBuffer);
      console.info(`Created ${path.relative(projectRoot, optimizedPath)}`);
    }

    if (relative.startsWith('src/assets/')) {
      manifest[normalizeKey(relative)] = normalizeKey(path.relative(projectRoot, optimizedPath));
    }

    const { size } = await fs.stat(file);
    if (size > sizeCeilingBytes) {
      oversizedRaw.push(relative);
    }
  }

  await writeManifest(manifest);

  if (oversizedRaw.length) {
    console.warn('Oversized raw images detected (consider archiving or recompressing):');
    oversizedRaw.sort().forEach((item) => console.warn(` - ${item}`));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
