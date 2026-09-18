"use client";

import React, { useState } from "react";
import ResourceScreen from "@/components/ResourceScreen";
import HotelExtraReservationsCalendar from "@/components/HotelExtraReservationsCalendar";
import { resources } from "@/lib/resources";
import { CalendarIcon } from "@/components/ui/Icons";

export default function HotelExtrasPage() {
  const [tab, setTab] = useState<"catalog" | "reservations">("catalog");
  const [reservationView, setReservationView] = useState<"calendar" | "list">("calendar");
  const [refreshKey, setRefreshKey] = useState(0);

  const tabBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 16px", borderRadius: "10px", fontSize: "13px", fontWeight: 600,
    cursor: "pointer", border: "none", transition: "all 150ms ease",
    background: active ? "linear-gradient(135deg, #21D0B3, #14AE98)" : "transparent",
    color: active ? "#ffffff" : "#64748b",
    boxShadow: active ? "0 2px 8px rgba(33,208,179,0.3)" : "none",
  });

  return (
    <div className="min-w-0 space-y-6 overflow-x-hidden">
      <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "12px" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          <button style={tabBtnStyle(tab === "catalog")} onClick={() => setTab("catalog")} type="button">
            Extras
          </button>
          <button style={tabBtnStyle(tab === "reservations")} onClick={() => setTab("reservations")} type="button">
            Reservas de Extras
          </button>
        </div>
      </section>

      {tab === "catalog" ? (
        <ResourceScreen
          config={resources.hotelExtras}
          refreshKey={refreshKey}
          onDataChanged={() => setRefreshKey((v) => v + 1)}
        />
      ) : (
        <>
          <section style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "12px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <button style={tabBtnStyle(reservationView === "calendar")} onClick={() => setReservationView("calendar")} type="button">
                <CalendarIcon size={13} strokeWidth={2} style={{ display: "inline", marginRight: "6px", verticalAlign: "middle" }} />
                Calendario
              </button>
              <button style={tabBtnStyle(reservationView === "list")} onClick={() => setReservationView("list")} type="button">
                Lista
              </button>
            </div>
          </section>

          {reservationView === "calendar" ? (
            <HotelExtraReservationsCalendar
              refreshKey={refreshKey}
              onDataChanged={() => setRefreshKey((v) => v + 1)}
            />
          ) : (
            <ResourceScreen
              config={resources.hotelExtraReservations}
              refreshKey={refreshKey}
              onDataChanged={() => setRefreshKey((v) => v + 1)}
            />
          )}
        </>
      )}
    </div>
  );
}
