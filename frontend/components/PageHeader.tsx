"use client";

import { useI18n } from "@/lib/i18n";

export default function PageHeader({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
      <div>
        <p className="section-label mb-2">{t("Modulo")}</p>
        <h3 className="font-black text-white" style={{ fontSize: "1.5rem", letterSpacing: "-0.02em" }}>{t(title)}</h3>
        <p className="text-sm mt-1 max-w-xl" style={{ color: "rgba(255,255,255,0.45)" }}>{t(description)}</p>
      </div>
      {action}
    </div>
  );
}
