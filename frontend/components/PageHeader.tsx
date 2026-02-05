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
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{t("Modulo")}</p>
        <h3 className="font-display text-2xl text-ink">{t(title)}</h3>
        <p className="text-sm text-slate-500 mt-1 max-w-xl">{t(description)}</p>
      </div>
      {action}
    </div>
  );
}
