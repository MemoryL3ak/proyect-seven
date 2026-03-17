"use client";

export default function PageHeader({
  action
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  if (!action) return null;
  return (
    <div className="flex justify-end mb-4">
      {action}
    </div>
  );
}
