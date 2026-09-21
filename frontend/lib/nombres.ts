/**
 * Nombres de personas escritos parejo.
 *
 * Los conductores llegan de tres lados —carga masiva, ficha de proveedor y
 * alta a mano— y cada uno escribe distinto: en el registro conviven "JUAN
 * FERNANDEZ", "luis paez", "Alex Arevalo" y "sergio avelino duran rebolledo".
 * En un listado eso se lee como tres sistemas en vez de uno.
 *
 * La normalización es de presentación, no destruye el dato guardado.
 */

/**
 * Partículas que van en minúscula dentro de un nombre: "Juana de los Ríos".
 * Al principio sí se capitalizan, porque ahí encabezan.
 */
const PARTICULAS = new Set(["de", "del", "la", "las", "los", "y", "da", "do", "dos", "van", "von"]);

/**
 * "JUAN FERNANDEZ" → "Juan Fernandez". "sergio duran" → "Sergio Duran".
 *
 * Respeta los guiones y los apóstrofos de los apellidos compuestos
 * ("Pérez-Soto", "O'Higgins") capitalizando cada parte, y no toca las tildes:
 * `toLowerCase` y `toUpperCase` las conservan.
 */
export function nombrePropio(valor?: string | null): string {
  const texto = String(valor ?? "").trim().replace(/\s+/g, " ");
  if (!texto) return "";

  return texto
    .toLocaleLowerCase("es")
    .split(" ")
    .map((palabra, indice) => {
      if (indice > 0 && PARTICULAS.has(palabra)) return palabra;
      // Cada tramo de un compuesto va con su propia mayúscula.
      return palabra
        .split(/([-'’])/)
        .map((tramo) =>
          /^[-'’]$/.test(tramo) || !tramo
            ? tramo
            : tramo.charAt(0).toLocaleUpperCase("es") + tramo.slice(1),
        )
        .join("");
    })
    .join(" ");
}
