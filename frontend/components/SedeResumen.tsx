"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";
import { MessageIcon, PhoneIcon } from "@/components/ui/Icons";
import { apiFetch } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { BRAND, STATE, SURFACE } from "@/lib/design";
import { openExternal, whatsappHref } from "@/lib/external-link";

/**
 * Vista de sedes para el Jefe de Misión: sólo lectura, con el coordinador de
 * cada sede y, arriba, el Coordinador General (rol de usuario con teléfono).
 * Operaciones sigue usando el maestro de Sedes para editar.
 */
type Venue = {
  id: string;
  eventId: string;
  name: string;
  address?: string | null;
  commune?: string | null;
  region?: string | null;
  notes?: string | null;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
};

type Coordinator = { name: string; phone: string };

export default function SedeResumen() {
  const { t } = useI18n();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [coordinator, setCoordinator] = useState<Coordinator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [events, allVenues, general] = await Promise.all([
          apiFetch<Array<{ id: string }>>("/events").catch(() => []),
          apiFetch<Venue[]>("/venues"),
          apiFetch<Coordinator | Record<string, never>>("/m/auth/coordinator").catch(() => null),
        ]);
        // El evento vigente es el más reciente (GET /events ordena por creación).
        const eventId = events[0]?.id;
        setVenues(
          (allVenues || [])
            .filter((v) => !eventId || v.eventId === eventId)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setCoordinator(general && "phone" in general && general.phone ? (general as Coordinator) : null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t("No se pudieron cargar las sedes."));
      } finally {
        setLoading(false);
      }
    })();
  }, [t]);

  const wa = (name: string, phone: string) =>
    openExternal(whatsappHref(phone, `Hola ${name}, te escribo desde la plataforma de los Juegos.`));

  return (
    <div className="space-y-6">
      <PageHeader title={t("Sedes")} description={t("Recintos del evento y sus coordinadores.")} />

      <section
        className="rounded-2xl p-5"
        style={{ background: `linear-gradient(135deg, ${BRAND.navyLight}, ${BRAND.navy})`, color: SURFACE.card }}
      >
        <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: BRAND.tealLight, margin: 0 }}>
          {t("Coordinador General")}
        </p>
        {coordinator ? (
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div>
              <p className="text-lg font-bold m-0">{coordinator.name}</p>
              <p className="text-sm m-0" style={{ color: "rgba(255,255,255,0.75)" }}>
                <PhoneIcon size={13} className="inline mr-1" />
                {coordinator.phone}
              </p>
            </div>
            <button
              type="button"
              onClick={() => wa(coordinator.name, coordinator.phone)}
              className="ml-auto"
              style={{ padding: "9px 14px", borderRadius: 10, border: "1px solid rgba(52,243,198,0.4)", background: "rgba(33,208,179,0.12)", color: BRAND.tealLight, fontWeight: 700, fontSize: 12.5, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <MessageIcon size={14} />
              {t("WhatsApp")}
            </button>
          </div>
        ) : (
          <p className="text-sm mt-2 m-0" style={{ color: "rgba(255,255,255,0.75)" }}>
            {t("Aún no hay un Coordinador General con teléfono registrado.")}
          </p>
        )}
      </section>

      {error && <p className="text-sm" style={{ color: STATE.dangerText }}>{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">{t("Cargando…")}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {venues.map((v) => (
            <article key={v.id} className="rounded-2xl p-4" style={{ border: `1px solid ${SURFACE.border}`, background: SURFACE.card }}>
              <p className="font-semibold text-ink m-0">{v.name}</p>
              {v.notes && <p className="text-xs text-slate-500 mt-1 m-0">{v.notes}</p>}
              <p className="text-sm text-slate-600 mt-2 m-0">
                {v.address || t("Dirección por confirmar")}
                {v.commune && !v.address?.includes(v.commune) ? `, ${v.commune}` : ""}
              </p>
              <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${SURFACE.border}` }}>
                <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: SURFACE.textSecondary, margin: 0 }}>
                  {t("Coordinador de sede")}
                </p>
                {v.coordinatorName || v.coordinatorPhone ? (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink m-0 truncate">{v.coordinatorName || t("Sin nombre")}</p>
                      {v.coordinatorPhone && <p className="text-xs text-slate-500 m-0">{v.coordinatorPhone}</p>}
                    </div>
                    {v.coordinatorPhone && (
                      <button
                        type="button"
                        className="btn ml-auto"
                        onClick={() => wa(v.coordinatorName || "", v.coordinatorPhone || "")}
                        title={t("WhatsApp")}
                      >
                        <MessageIcon size={14} />
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 mt-1 m-0">{t("Por asignar")}</p>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
