import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const dataPath = path.join(root, 'src', 'data.ts');
const utilsPath = path.join(root, 'src', 'utils.ts');
const publicDir = path.join(root, 'public');
const data = fs.readFileSync(dataPath, 'utf8');
const utils = fs.readFileSync(utilsPath, 'utf8');

const missingFiles = [];
const assetRefs = new Set([
  ...[...data.matchAll(/imageUrl: '([^']+)'/g)].map((match) => match[1]),
  ...[...utils.matchAll(/'([^']*\/coach-shots\/[^']+)'/g)].map((match) => match[1]),
]);

for (const assetPath of assetRefs) {
  if (!assetPath.startsWith('/')) {
    missingFiles.push(`${assetPath} 不是 public 绝对路径`);
    continue;
  }

  const fullPath = path.join(publicDir, assetPath.slice(1));
  if (!fs.existsSync(fullPath)) {
    missingFiles.push(assetPath);
  }
}

const warmupsWithoutImage = [];
for (const block of data.matchAll(/warmup: \[([\s\S]*?)\],\n\s*exerciseIds:/g)) {
  for (const item of block[1].matchAll(/\{[^{}]*name: '([^']+)'[^{}]*detail: '[^']+'[^{}]*\}/g)) {
    const warmupEntry = item[0];
    if (!warmupEntry.includes('imageUrl:')) {
      warmupsWithoutImage.push(item[1]);
    }
  }
}

if (missingFiles.length > 0 || warmupsWithoutImage.length > 0) {
  if (missingFiles.length > 0) {
    console.error('Missing image assets:');
    for (const item of missingFiles) {
      console.error(`- ${item}`);
    }
  }

  if (warmupsWithoutImage.length > 0) {
    console.error('Warmup items without imageUrl:');
    for (const item of warmupsWithoutImage) {
      console.error(`- ${item}`);
    }
  }

  process.exit(1);
}

console.log('Asset references are valid.');
