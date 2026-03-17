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
    <div
      className="flex flex-wrap items-center justify-between gap-4 mb-6 pb-5"
      style={{ borderBottom: "1px solid var(--border-muted)" }}
    >
      <div>
        <p className="section-label mb-1.5">{t("Modulo")}</p>
        <h3
          className="font-bold"
          style={{ fontSize: "1.3rem", letterSpacing: "-0.02em", color: "var(--text)" }}
        >
          {t(title)}
        </h3>
        <p className="text-sm mt-1 max-w-xl" style={{ color: "var(--text-muted)" }}>
          {t(description)}
        </p>
      </div>
      {action}
    </div>
  );
}
