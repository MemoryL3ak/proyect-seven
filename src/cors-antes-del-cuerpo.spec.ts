import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * 29-09-2026: con el lector del cuerpo antes de CORS, una subida sobre el tope
 * respondía 413 sin Access-Control-Allow-Origin y el teléfono del conductor
 * sólo veía "Load failed". CORS tiene que registrarse primero.
 */
describe('main.ts: CORS antes de leer el cuerpo', () => {
  const main = readFileSync(join(__dirname, 'main.ts'), 'utf8');

  it('enableCors va antes de express.json y express.urlencoded', () => {
    const cors = main.indexOf('app.enableCors(');
    expect(cors).toBeGreaterThan(-1);
    expect(main.indexOf("express').json(")).toBeGreaterThan(cors);
    expect(main.indexOf("express').urlencoded(")).toBeGreaterThan(cors);
  });
});
