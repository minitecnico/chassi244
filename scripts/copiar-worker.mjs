/** O leitor de PDF roda num worker separado, para a tela não travar enquanto
 *  um catálogo de 300 páginas é lido. O arquivo do worker vem junto com a
 *  biblioteca; aqui ele é copiado para `public/`, onde o navegador consegue
 *  buscá-lo por um endereço fixo. Roda sozinho depois de `npm install`. */

import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const raiz = join(dirname(require.resolve("pdfjs-dist/package.json")), "build");
const destino = join(process.cwd(), "public");

mkdirSync(destino, { recursive: true });
copyFileSync(join(raiz, "pdf.worker.min.mjs"), join(destino, "pdf.worker.min.mjs"));

console.log("leitor de PDF pronto em public/pdf.worker.min.mjs");
