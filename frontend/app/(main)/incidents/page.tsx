"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";

type IncidentEntry = {
  note: string;
  time: string;
};

export default function IncidentsPage() {
  const [entries, setEntries] = useState<IncidentEntry[]>([]);
  const [note, setNote] = useState("");

  const addEntry = (event: React.FormEvent) => {
    event.preventDefault();
    if (!note.trim()) return;
    setEntries([{ note, time: new Date().toISOString() }, ...entries]);
    setNote("");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidentes"
        description="Registro rápido de cambios no planificados y eventos operativos."
      />

      <section className="surface rounded-2xl p-6">
        <h4 className="font-display text-xl text-ink mb-4">Nueva anotacion</h4>
        <form onSubmit={addEntry} className="flex flex-col gap-3">
          <textarea
            className="input min-h-[120px]"
            placeholder="Describe el incidente, impacto y acciones tomadas..."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <button className="btn btn-primary w-fit" type="submit">
            Guardar en bitacora
          </button>
        </form>
      </section>

      <section className="surface rounded-2xl p-6">
        <h4 className="font-display text-xl text-ink mb-4">Bitacora reciente</h4>
        {entries.length === 0 ? (
          <p className="text-sm text-slate-500">Sin incidentes cargados en esta sesión.</p>
        ) : (
          <ul className="space-y-3 text-sm text-slate-600">
            {entries.map((entry) => (
              <li key={entry.time} className="border-b border-slate-200 pb-3">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{entry.time}</p>
                <p>{entry.note}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
