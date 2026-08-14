// El worker de PDF.js se importa sólo por su efecto: registra
// globalThis.pdfjsWorker para que PDF.js no tenga que descargarlo.
// El paquete no publica tipos para este archivo.
declare module "pdfjs-dist/legacy/build/pdf.worker.min.mjs";
