"use client";

import { useId, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { apiFetch } from "@/lib/api";

type ImportType = "athletes" | "hospitality";

type ImportError = {
  row: number;
  field?: string;
  message: string;
};

const athleteHeaders = [
  "event_id",
  "delegation_id",
  "discipline_id",
  "full_name",
  "email",
  "country_code",
  "passport_number",
  "date_of_birth",
  "user_type",
  "luggage_type",
  "luggage_notes",
  "flight_number",
  "airline",
  "origin",
  "arrival_time",
  "departure_time",
  "departure_gate",
  "arrival_baggage",
  "hotel_name",
  "room_type",
  "room_number",
  "bed_type",
  "status"
] as const;

const hospitalityHeaders = [
  "event_id",
  "hotel_name",
  "hotel_address",
  "room_number",
  "room_type",
  "bed_type",
  "bed_status"
] as const;

const luggageLabels: Record<string, string> = {
  BAG: "Bolso",
  SUITCASE_8: "Maleta 8",
  SUITCASE_15: "Maleta 15",
  SUITCASE_23: "Maleta 23",
  EXTRA_BAGGAGE: "Sobreequipaje"
};

const luggageTypes = new Set(Object.keys(luggageLabels));
const roomTypes = new Set(["SINGLE", "DOUBLE", "TRIPLE", "SUITE"]);
const bedStatuses = new Set(["AVAILABLE", "OCCUPIED"]);

const normalizeHeader = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, "_");

const toDateTime = (value: string) => {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toDateOnly = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const downloadTemplate = (headers: readonly string[], fileName: string) => {
  const worksheet = XLSX.utils.aoa_to_sheet([Array.from(headers)]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
  XLSX.writeFile(workbook, fileName);
};

const parseSheet = (file: File) => {
  return new Promise<Record<string, string>[]>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
          defval: "",
          raw: false
        });
        resolve(rows);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export default function BulkImportPanel({ type }: { type: ImportType }) {
  const inputId = useId();
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const headers = type === "athletes" ? athleteHeaders : hospitalityHeaders;

  const normalizedRows = useMemo(() => {
    return rows.map((row) => {
      const next: Record<string, string> = {};
      Object.entries(row).forEach(([key, value]) => {
        next[normalizeHeader(key)] = String(value ?? "").trim();
      });
      return next;
    });
  }, [rows]);

  const handleFile = async (file: File | null) => {
    setResult(null);
    setErrors([]);
    if (!file) {
      setFileName(null);
      setRows([]);
      return;
    }
    setFileName(file.name);
    const parsed = await parseSheet(file);
    setRows(parsed);
  };

  const validate = () => {
    const nextErrors: ImportError[] = [];
    normalizedRows.forEach((row, index) => {
      const rowNumber = index + 2;
      const eventId = row.event_id;
      if (!eventId) {
        nextErrors.push({ row: rowNumber, field: "event_id", message: "Requerido" });
      }
      if (type === "athletes") {
        if (!row.full_name) {
          nextErrors.push({ row: rowNumber, field: "full_name", message: "Requerido" });
        }
        if (row.country_code && row.country_code.length !== 3) {
          nextErrors.push({
            row: rowNumber,
            field: "country_code",
            message: "Debe tener 3 letras (ej. CHL)"
          });
        }
        if (row.luggage_type && !luggageTypes.has(row.luggage_type)) {
          nextErrors.push({
            row: rowNumber,
            field: "luggage_type",
            message: "Tipo de equipaje inválido"
          });
        }
        if (row.room_type && !roomTypes.has(row.room_type)) {
          nextErrors.push({
            row: rowNumber,
            field: "room_type",
            message: "Tipo de habitación inválido"
          });
        }
        if (row.date_of_birth && !toDateOnly(row.date_of_birth)) {
          nextErrors.push({
            row: rowNumber,
            field: "date_of_birth",
            message: "Fecha inválida (YYYY-MM-DD)"
          });
        }
        if (row.arrival_time && !toDateTime(row.arrival_time)) {
          nextErrors.push({
            row: rowNumber,
            field: "arrival_time",
            message: "Fecha/hora inválida (YYYY-MM-DD HH:mm)"
          });
        }
        if (row.departure_time && !toDateTime(row.departure_time)) {
          nextErrors.push({
            row: rowNumber,
            field: "departure_time",
            message: "Fecha/hora inválida (YYYY-MM-DD HH:mm)"
          });
        }
      } else {
        if (!row.hotel_name) {
          nextErrors.push({ row: rowNumber, field: "hotel_name", message: "Requerido" });
        }
        if (!row.room_number) {
          nextErrors.push({ row: rowNumber, field: "room_number", message: "Requerido" });
        }
        if (row.room_type && !roomTypes.has(row.room_type)) {
          nextErrors.push({
            row: rowNumber,
            field: "room_type",
            message: "Tipo de habitación inválido"
          });
        }
        if (row.bed_status && !bedStatuses.has(row.bed_status)) {
          nextErrors.push({
            row: rowNumber,
            field: "bed_status",
            message: "Estado de cama inválido"
          });
        }
      }
    });
    setErrors(nextErrors);
    return nextErrors.length === 0;
  };

  const importAthletes = async () => {
    setLoading(true);
    setResult(null);
    try {
      const athletes = await apiFetch<Record<string, any>[]>("/athletes");
      const athleteByEmail = new Map(
        (athletes || [])
          .filter((item) => item.email)
          .map((item) => [String(item.email).toLowerCase(), item])
      );
      const accommodations = await apiFetch<Record<string, any>[]>("/accommodations");
      const accommodationByKey = new Map(
        (accommodations || []).map((item) => [
          `${item.eventId}::${String(item.name).toLowerCase()}`,
          item
        ])
      );

      let created = 0;
      let updated = 0;
      const rowErrors: ImportError[] = [];

      for (let index = 0; index < normalizedRows.length; index += 1) {
        const row = normalizedRows[index];
        const rowNumber = index + 2;
        const payload: Record<string, any> = {
          eventId: row.event_id || undefined,
          delegationId: row.delegation_id || undefined,
          disciplineId: row.discipline_id || undefined,
          fullName: row.full_name || undefined,
          email: row.email || undefined,
          countryCode: row.country_code || undefined,
          passportNumber: row.passport_number || undefined,
          dateOfBirth: row.date_of_birth ? toDateOnly(row.date_of_birth) : undefined,
          userType: row.user_type || undefined,
          luggageType: row.luggage_type || undefined,
          luggageNotes: row.luggage_notes || undefined,
          flightNumber: row.flight_number || undefined,
          airline: row.airline || undefined,
          origin: row.origin || undefined,
          arrivalTime: row.arrival_time ? toDateTime(row.arrival_time) : undefined,
          departureTime: row.departure_time ? toDateTime(row.departure_time) : undefined,
          departureGate: row.departure_gate || undefined,
          arrivalBaggage: row.arrival_baggage || undefined,
          roomType: row.room_type || undefined,
          roomNumber: row.room_number || undefined,
          bedType: row.bed_type || undefined,
          status: row.status || undefined
        };

        if (!payload.eventId || !payload.fullName) {
          rowErrors.push({ row: rowNumber, message: "Faltan campos requeridos" });
          continue;
        }

        if (row.hotel_name) {
          const key = `${payload.eventId}::${row.hotel_name.toLowerCase()}`;
          const hotel = accommodationByKey.get(key);
          if (!hotel) {
            rowErrors.push({
              row: rowNumber,
              field: "hotel_name",
              message: "Hotel no encontrado"
            });
          } else {
            payload.hotelAccommodationId = hotel.id;
          }
        }

        const emailKey = payload.email ? String(payload.email).toLowerCase() : "";
        const existing = emailKey ? athleteByEmail.get(emailKey) : null;
        try {
          if (existing?.id) {
            await apiFetch(`/athletes/${existing.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            updated += 1;
          } else {
            await apiFetch("/athletes", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload)
            });
            created += 1;
          }
        } catch (error) {
          rowErrors.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : "Error al importar"
          });
        }
      }

      setErrors(rowErrors);
      setResult(`Importados: ${created} creados, ${updated} actualizados.`);
    } finally {
      setLoading(false);
    }
  };

  const importHospitality = async () => {
    setLoading(true);
    setResult(null);
    try {
      const accommodations = await apiFetch<Record<string, any>[]>("/accommodations");
      const rooms = await apiFetch<Record<string, any>[]>("/hotel-rooms");
      const beds = await apiFetch<Record<string, any>[]>("/hotel-beds");

      const accommodationByKey = new Map(
        (accommodations || []).map((item) => [
          `${item.eventId}::${String(item.name).toLowerCase()}`,
          item
        ])
      );

      const roomByKey = new Map(
        (rooms || []).map((item) => [
          `${item.hotelId}::${String(item.roomNumber).toLowerCase()}`,
          item
        ])
      );

      const bedCountByKey = new Map<string, number>();
      (beds || []).forEach((bed) => {
        const key = `${bed.roomId}::${String(bed.bedType).toUpperCase()}`;
        bedCountByKey.set(key, (bedCountByKey.get(key) ?? 0) + 1);
      });

      const rowErrors: ImportError[] = [];

      const roomCounts = new Map<string, number>();
      normalizedRows.forEach((row) => {
        const key = `${row.event_id}::${row.hotel_name}::${row.room_number}`;
        roomCounts.set(key, (roomCounts.get(key) ?? 0) + 1);
      });

      for (let index = 0; index < normalizedRows.length; index += 1) {
        const row = normalizedRows[index];
        const rowNumber = index + 2;
        if (!row.event_id || !row.hotel_name || !row.room_number || !row.bed_type) {
          rowErrors.push({ row: rowNumber, message: "Faltan campos requeridos" });
          continue;
        }

        const hotelKey = `${row.event_id}::${row.hotel_name.toLowerCase()}`;
        let hotel = accommodationByKey.get(hotelKey);
        if (!hotel) {
          try {
            const createdHotel = await apiFetch<Record<string, any>>("/accommodations", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                eventId: row.event_id,
                name: row.hotel_name,
                address: row.hotel_address || undefined
              })
            });
            accommodationByKey.set(hotelKey, createdHotel);
            hotel = createdHotel;
          } catch (error) {
            rowErrors.push({
              row: rowNumber,
              message: error instanceof Error ? error.message : "Error creando hotel"
            });
            continue;
          }
        }

        const roomKey = `${hotel.id}::${row.room_number.toLowerCase()}`;
        let room = roomByKey.get(roomKey);
        if (!room) {
          const countKey = `${row.event_id}::${row.hotel_name}::${row.room_number}`;
          const bedsCapacity = roomCounts.get(countKey) ?? 1;
          try {
            const createdRoom = await apiFetch<Record<string, any>>("/hotel-rooms", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                hotelId: hotel.id,
                roomNumber: row.room_number,
                roomType: row.room_type || "SINGLE",
                bedsCapacity
              })
            });
            roomByKey.set(roomKey, createdRoom);
            room = createdRoom;
          } catch (error) {
            rowErrors.push({
              row: rowNumber,
              message: error instanceof Error ? error.message : "Error creando habitación"
            });
            continue;
          }
        }

        const bedKey = `${room.id}::${row.bed_type.toUpperCase()}`;
        const currentCount = bedCountByKey.get(bedKey) ?? 0;
        try {
          await apiFetch("/hotel-beds", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              roomId: room.id,
              bedType: row.bed_type,
              status: row.bed_status || "AVAILABLE"
            })
          });
          bedCountByKey.set(bedKey, currentCount + 1);
        } catch (error) {
          rowErrors.push({
            row: rowNumber,
            message: error instanceof Error ? error.message : "Error creando cama"
          });
        }
      }

      setErrors(rowErrors);
      setResult(
        rowErrors.length === 0
          ? "Carga completada."
          : `Carga finalizada con ${rowErrors.length} errores.`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const ok = validate();
    if (!ok) return;
    if (type === "athletes") {
      await importAthletes();
    } else {
      await importHospitality();
    }
  };

  const previewRows = normalizedRows.slice(0, 5);

  return (
    <section className="surface rounded-3xl p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Carga masiva</p>
          <h2 className="font-display text-2xl text-ink">
            {type === "athletes" ? "Participantes" : "Hotelería"}
          </h2>
          <p className="text-sm text-slate-500">
            Subir XLSX, revisar vista previa y cargar.
          </p>
        </div>
        <button
          className="btn btn-ghost"
          type="button"
          onClick={() =>
            downloadTemplate(
              headers,
              type === "athletes" ? "template-participantes.xlsx" : "template-hoteleria.xlsx"
            )
          }
        >
          Descargar plantilla
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-2 text-sm text-slate-600">
          <span>Archivo XLSX</span>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={inputId}
              className="sr-only"
              type="file"
              accept=".xlsx"
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
            <label htmlFor={inputId} className="btn btn-ghost cursor-pointer">
              Seleccionar archivo
            </label>
            <span className="text-xs text-slate-500">
              {fileName ? `Archivo: ${fileName}` : "Sin archivo seleccionado"}
            </span>
          </div>
        </div>
        <button className="btn btn-ghost" type="button" onClick={validate} disabled={!rows.length}>
          Validar
        </button>
        <button className="btn btn-primary" type="button" onClick={handleImport} disabled={!rows.length || loading}>
          {loading ? "Cargando..." : "Cargar"}
        </button>
      </div>

      {previewRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                {headers.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row, index) => (
                <tr key={`${index}`}>
                  {headers.map((header) => (
                    <td key={header}>{row[header] || "-"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {errors.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-semibold">Errores encontrados</p>
          <ul className="list-disc pl-5">
            {errors.slice(0, 20).map((error, index) => (
              <li key={`${error.row}-${index}`}>
                Fila {error.row}
                {error.field ? ` (${error.field})` : ""}: {error.message}
              </li>
            ))}
          </ul>
          {errors.length > 20 && (
            <p className="mt-2 text-xs text-rose-600">
              Mostrando 20 de {errors.length} errores.
            </p>
          )}
        </div>
      )}

      {result && <p className="text-sm text-emerald-600">{result}</p>}
    </section>
  );
}
