// Genera build/icon.ico a partir de public/icon-512.png para el instalador de
// Windows (electron-builder). Se corre una sola vez de forma manual; el .ico
// resultante se commitea, no hace falta regenerarlo en cada build.

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pngToIco from 'png-to-ico';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'public', 'icon-512.png');
const outDir = join(root, 'build');
const outFile = join(outDir, 'icon.ico');

if (!existsSync(source)) {
    console.error(`[build-icon] No se encontró ${source}`);
    process.exit(1);
}

if (!existsSync(outDir)) mkdirSync(outDir);

const buffer = await pngToIco(source);
writeFileSync(outFile, buffer);
console.log(`[build-icon] Generado ${outFile}`);
