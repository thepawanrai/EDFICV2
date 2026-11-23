import 'dotenv/config';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

if (process.env.NODE_ENV !== 'test') {
  process.env.NODE_ENV = 'production';
}

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const builtServer = path.join(rootDir, 'dist', 'server', 'server.js');
const builtClient = path.join(rootDir, 'dist', 'client', 'index.html');

if (!fs.existsSync(builtServer) || !fs.existsSync(builtClient)) {
  console.log('EDFIC production bundle not found; running npm run build...');
  execSync('npm run build', { stdio: 'inherit', cwd: rootDir });
}

await import(pathToFileURL(builtServer).href);
