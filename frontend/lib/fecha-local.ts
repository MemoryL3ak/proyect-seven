/**
 * Hora de un campo "datetime-local" (AAAA-MM-DDTHH:mm, en la hora del
 * navegador) → ISO con zona. 28-09-2026: el formulario de AND mandaba la hora
 * tal cual, sin zona, y la base la tomaba como UTC: cada guardado habría
 * corrido la llegada y la salida tres horas antes.
 */
export function isoDesdeLocal(valor: unknown): string | undefined {
  const texto = typeof valor === "string" ? valor.trim() : "";
  if (!texto) return undefined;
  const d = new Date(texto);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}
