// Copia el worker de PDF.js a public/ como optimización, no como requisito.
//
// El visor ya lleva el worker dentro del bundle (ver PdfCanvasViewer), así que
// funciona aunque este archivo no exista. Sirve sólo para que, cuando el
// navegador puede crear un Worker de verdad, el renderizado ocurra fuera del
// hilo principal y la interfaz no se congele con documentos grandes.
//
// Se copia con extensión .js: algunos hostings devuelven un MIME incorrecto
// para .mjs y el Worker no llega a cargarse.
//
// Se usa la variante `legacy`, compilada para navegadores antiguos: el WebView
// de la app móvil no siempre soporta la sintaxis del build moderno.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgPath = require.resolve("pdfjs-dist/package.json");
const source = join(dirname(pkgPath), "legacy", "build", "pdf.worker.min.mjs");
const target = join(process.cwd(), "public", "pdf.worker.min.js");

mkdirSync(dirname(target), { recursive: true });
copyFileSync(source, target);
console.log(
  `pdf.worker.min.js (legacy) copiado — pdfjs-dist ${require("pdfjs-dist/package.json").version}`,
);
