"use client";

/** ⚠ DIAGNÓSTICO TEMPORAL — overlay visible solo dentro de la app nativa.
 *  Muestra el latido del hilo JS y los últimos hitos/errores del arranque.
 *  pointerEvents:none → no interfiere con ningún toque. Quitar al resolver. */

import { useEffect, useState } from "react";
import { dlogArmGlobal, dlogEntries, dlogSubscribe } from "@/lib/native-debug";
import { isInReactNativeWebView } from "@/lib/mobile-auth";

export default function NativeDebugOverlay() {
  const [, force] = useState(0);
  const [beat, setBeat] = useState(0);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!isInReactNativeWebView()) return;
    setShow(true);
    dlogArmGlobal();
    const unsubscribe = dlogSubscribe(() => force((n) => n + 1));
    const timer = setInterval(() => setBeat((b) => b + 1), 500);
    return () => { unsubscribe(); clearInterval(timer); };
  }, []);

  if (!show) return null;
  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 2147483000,
      pointerEvents: "none", background: "rgba(2,10,20,0.78)", color: "#7CFC9A",
      fontFamily: "Menlo, monospace", fontSize: 9, lineHeight: 1.4,
      padding: "34px 8px 6px", whiteSpace: "pre-wrap",
    }}>
      {`♥ latido ${beat}  (si este número se detiene, el hilo JS murió ahí)\n${dlogEntries().join("\n")}`}
    </div>
  );
}
