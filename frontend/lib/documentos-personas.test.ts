import { describe, expect, it } from "vitest";
import {
  cumpleFiltroDocumentacion,
  cumpleFiltroTipo,
  documentacionDe,
  documentosRequeridos,
  DOCS_CONDUCTOR,
  DOCS_PERSONA,
  fechaDeDocumento,
  tipoDePersona,
} from "./documentos-personas";

/**
 * Documentación de participantes de proveedores (23-09-2026). Ariel quiere
 * ver quién no ha subido documentos: conductores y otros, por proveedor y
 * por estado. El 23-09 había 80 participantes de transporte y sólo 21 con
 * algún documento; el rol venía escrito como "conductor", "CONDUCTOR" y
 * hasta "condcutor".
 */
const URL = (key: string, ms: number) =>
  `https://x.supabase.co/storage/v1/object/public/driver-documents/abc/${key}-${ms}.pdf`;

describe("tipoDePersona", () => {
  it("reconoce al conductor por el rol escrito, con mayúsculas o minúsculas", () => {
    expect(tipoDePersona({ userType: "conductor" })).toBe("CONDUCTOR");
    expect(tipoDePersona({ userType: "CONDUCTOR" })).toBe("CONDUCTOR");
    expect(tipoDePersona({ userType: " Conductor " })).toBe("CONDUCTOR");
  });
  it("y por la marca isDriver de la ficha", () => {
    expect(tipoDePersona({ userType: null, metadata: { isDriver: true } })).toBe("CONDUCTOR");
  });
  it("el resto es otro participante", () => {
    expect(tipoDePersona({ userType: "coordinador" })).toBe("OTRO");
    expect(tipoDePersona({ userType: null })).toBe("OTRO");
  });
});

describe("documentosRequeridos", () => {
  it("al conductor de transporte se le piden los suyos y los del vehículo", () => {
    expect(documentosRequeridos({ userType: "conductor" }, "TRANSPORTE")).toEqual(DOCS_CONDUCTOR);
  });
  it("al resto del personal de transporte, sólo los personales", () => {
    expect(documentosRequeridos({ userType: "coordinador" }, "TRANSPORTE")).toEqual(DOCS_PERSONA);
  });
  it("otros proveedores no suben documentos por esta vía", () => {
    expect(documentosRequeridos({ userType: "conductor" }, "SALUD")).toEqual([]);
    expect(documentosRequeridos({ userType: "conductor" }, null)).toEqual([]);
  });
});

describe("documentacionDe", () => {
  it("sin ninguna URL doc_* está sin documentos", () => {
    const d = documentacionDe({ userType: "conductor", metadata: { photoUrl: "x" } }, "TRANSPORTE");
    expect(d.estado).toBe("SIN_DOCUMENTOS");
    expect(d.subidos).toEqual([]);
    expect(d.faltantes).toHaveLength(12);
    expect(d.ultimaSubida).toBeNull();
  });

  it("con algunos es incompleta y nombra los que faltan", () => {
    const d = documentacionDe(
      { userType: "conductor", metadata: { doc_licencia: URL("doc_licencia", 1_758_600_000_000), doc_carnet: "" } },
      "TRANSPORTE",
    );
    expect(d.estado).toBe("INCOMPLETA");
    expect(d.subidos.map((x) => x.key)).toEqual(["doc_licencia"]);
    expect(d.faltantes.map((x) => x.key)).toContain("doc_carnet");
    expect(d.ultimaSubida?.getTime()).toBe(1_758_600_000_000);
  });

  it("con todos los requeridos es completa, y la última subida es la más nueva", () => {
    const meta: Record<string, string> = {};
    DOCS_PERSONA.forEach((doc, i) => { meta[doc.key] = URL(doc.key, 1_758_000_000_000 + i * 1000); });
    const d = documentacionDe({ userType: "coordinador", metadata: meta }, "TRANSPORTE");
    expect(d.estado).toBe("COMPLETA");
    expect(d.ultimaSubida?.getTime()).toBe(1_758_000_000_000 + 4000);
  });

  it("para un proveedor que no es de transporte no aplica", () => {
    expect(documentacionDe({ userType: "conductor" }, "ASEO").estado).toBe("NO_APLICA");
  });
});

describe("fechaDeDocumento", () => {
  it("lee los milisegundos del nombre del archivo", () => {
    expect(fechaDeDocumento(URL("doc_soap", 1_758_600_000_000))?.getTime()).toBe(1_758_600_000_000);
  });
  it("una URL con otro formato no tiene fecha", () => {
    expect(fechaDeDocumento("https://x/y/licencia.pdf")).toBeNull();
  });
});

describe("filtros", () => {
  it("'pendientes' junta sin documentos e incompleta", () => {
    expect(cumpleFiltroDocumentacion("SIN_DOCUMENTOS", "PENDIENTE")).toBe(true);
    expect(cumpleFiltroDocumentacion("INCOMPLETA", "PENDIENTE")).toBe(true);
    expect(cumpleFiltroDocumentacion("COMPLETA", "PENDIENTE")).toBe(false);
    expect(cumpleFiltroDocumentacion("NO_APLICA", "PENDIENTE")).toBe(false);
  });
  it("vacío deja pasar todo; un estado exige ese estado", () => {
    expect(cumpleFiltroDocumentacion("NO_APLICA", "")).toBe(true);
    expect(cumpleFiltroDocumentacion("COMPLETA", "COMPLETA")).toBe(true);
    expect(cumpleFiltroDocumentacion("INCOMPLETA", "COMPLETA")).toBe(false);
  });
  it("el tipo filtra conductores u otros", () => {
    expect(cumpleFiltroTipo({ userType: "conductor" }, "CONDUCTOR")).toBe(true);
    expect(cumpleFiltroTipo({ userType: "conductor" }, "OTRO")).toBe(false);
    expect(cumpleFiltroTipo({ userType: null }, "")).toBe(true);
  });
});

/* ─── Planilla exportable (26-09-2026) ─── */
import { planillaDocumentacion } from "./documentos-personas";

describe("planillaDocumentacion", () => {
  it("una fila por persona y una columna por documento", () => {
    const conductor = documentacionDe({ userType: "conductor", metadata: { doc_licencia: URL("doc_licencia", 1_758_600_000_000) } }, "TRANSPORTE");
    const otro = documentacionDe({ userType: "coordinador", metadata: {} }, "TRANSPORTE");
    const { headers, rows } = planillaDocumentacion([
      { nombre: "Ana", rut: "1-9", telefono: "+569", proveedor: "BVAN", tipo: "CONDUCTOR", doc: conductor },
      { nombre: "Beto", tipo: "OTRO", doc: otro },
    ]);
    expect(headers.slice(0, 9)).toEqual(["Persona", "RUT", "Teléfono", "Proveedor", "Tipo", "Estado", "Subidos", "Faltan", "Última subida"]);
    const col = (label: string) => headers.indexOf(label);
    expect(rows[0][col("Estado")]).toBe("Incompleta");
    expect(rows[0][col("Subidos")]).toBe("1/12");
    expect(rows[0][col("Licencia de conducir")]).toBe("Sí");
    expect(rows[0][col("SOAP")]).toBe("No");
    expect(rows[1][col("SOAP")]).toBe("No aplica");
    expect(rows[1][col("Fotocopia Carnet")]).toBe("No");
    expect(rows[1][col("Estado")]).toBe("Sin documentos");
  });
});
