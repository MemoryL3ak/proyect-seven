// Copia el worker de PDF.js a public/ para servirlo como archivo estático.
//
// El patrón `new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url)`
// rompe el build de Next 14, así que el worker se sirve desde /public. Se
// copia en cada build para que nunca quede desfasado respecto a la versión de
// pdfjs-dist instalada: un worker de otra versión hace fallar el visor.
//
// Se usa la variante `legacy`, compilada para navegadores antiguos: el WebView
// de la app móvil no siempre soporta la sintaxis del build moderno.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("pdfjs-dist/package.json");
const source = join(dirname(pkgPath), "legacy", "build", "pdf.worker.min.mjs");
const target = join(process.cwd(), "public", "pdf.worker.min.mjs");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(
  `pdf.worker.min.mjs (legacy) copiado — pdfjs-dist ${require("pdfjs-dist/package.json").version}`,
);
