import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 28-09-2026: en Safari y en la app del iPhone, un toque en cualquier parte de
 * un <label> se manda a su PRIMER control. Con dos controles dentro, el
 * segundo queda inalcanzable: en "Editar registro" tocar el número de
 * teléfono abría la lista de países y no dejaba escribir; en la ficha de
 * salud tocar "Mes" abría la lista del día. En Chrome no se nota.
 *
 * Esta prueba recorre las pantallas y falla si un <label> envuelve más de un
 * control. Un campo de varios controles va en un <div>. Si un botón convive a
 * propósito con una casilla en la misma etiqueta, su onClick debe llamar a
 * preventDefault() (así el toque no llega a la casilla).
 */
const RAIZ = join(__dirname, "..");
const CONTROL = /<(input|select|textarea|button)\b|<(CountrySelect|PhoneField|SpanishDateField)\b/g;

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === "node_modules" ? [] : archivos(ruta);
    return ruta.endsWith(".tsx") ? [ruta] : [];
  });
}

/** Contenido de cada <label>…</label>, respetando etiquetas anidadas. */
function etiquetas(fuente: string): Array<{ linea: number; bloque: string }> {
  const out: Array<{ linea: number; bloque: string }> = [];
  const re = /<label\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fuente))) {
    const ini = m.index;
    let prof = 0;
    let i = ini;
    let fin = -1;
    for (;;) {
      const abre = fuente.indexOf("<label", i + 1);
      const cierra = fuente.indexOf("</label>", i + 1);
      if (cierra === -1) break;
      if (abre !== -1 && abre < cierra) {
        prof += 1;
        i = abre;
        continue;
      }
      if (prof === 0) {
        fin = cierra;
        break;
      }
      prof -= 1;
      i = cierra;
    }
    if (fin === -1) continue;
    // Sólo el contenido propio: lo de etiquetas anidadas se revisa aparte.
    let bloque = fuente.slice(ini + 1, fin);
    bloque = bloque.replace(/<label\b[\s\S]*?<\/label>/g, "");
    out.push({ linea: fuente.slice(0, ini).split("\n").length, bloque });
  }
  return out;
}

describe("una etiqueta, un control", () => {
  it("ningún <label> envuelve dos controles (Safari / iPhone)", () => {
    const problemas: string[] = [];
    for (const archivo of [...archivos(join(RAIZ, "app")), ...archivos(join(RAIZ, "components"))]) {
      const fuente = readFileSync(archivo, "utf8");
      for (const { linea, bloque } of etiquetas(fuente)) {
        const controles = (bloque.match(CONTROL) ?? []).filter((c) => !/type="hidden"/.test(c));
        if (controles.length < 2) continue;
        if (/preventDefault\(\)/.test(bloque)) continue;
        problemas.push(`${relative(RAIZ, archivo)}:${linea} (${controles.join(", ")})`);
      }
    }
    expect(problemas).toEqual([]);
  });
});
