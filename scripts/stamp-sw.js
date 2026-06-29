import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// 用构建产物（JS/CSS）内容哈希给 Service Worker 的缓存桶命名，
// 保证每次发版 CACHE_NAME 都变化，activate 时清掉旧缓存，避免发版后返回陈旧资源。
const distDir = path.join(process.cwd(), 'dist');
const swPath = path.join(distDir, 'sw.js');

if (!fs.existsSync(swPath)) {
  console.error('dist/sw.js not found; run vite build first.');
  process.exit(1);
}

const assetsDir = path.join(distDir, 'assets');
const assetFiles = fs.existsSync(assetsDir)
  ? fs
      .readdirSync(assetsDir)
      .filter((name) => name.endsWith('.js') || name.endsWith('.css'))
      .sort()
  : [];

const hash = createHash('sha256');
for (const name of assetFiles) {
  hash.update(name);
  hash.update(fs.readFileSync(path.join(assetsDir, name)));
}
const buildHash = hash.digest('hex').slice(0, 12);

const sw = fs.readFileSync(swPath, 'utf8');
if (!sw.includes('__BUILD_HASH__')) {
  console.error('dist/sw.js has no __BUILD_HASH__ placeholder; check public/sw.js.');
  process.exit(1);
}
fs.writeFileSync(swPath, sw.replace(/__BUILD_HASH__/g, buildHash));
console.log(`Stamped service worker cache version: fitness-pwa-${buildHash}`);
