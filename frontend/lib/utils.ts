type HumanizeOptions = {
  labels?: Record<string, string>;
  translate?: (value: string) => string;
};

export function humanizePath(pathname: string, options: HumanizeOptions = {}) {
  const translate = options.translate ?? ((value: string) => value);
  const labels = options.labels ?? {};

  if (pathname === "/") return translate("Dashboard");

  return pathname
    .split("/")
    .filter(Boolean)
    .map((part) => {
      const label = labels[part];
      if (label) return translate(label);

      const normalized = part.replace(/-/g, " ");
      const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1);
      return translate(capitalized);
    })
    .join(" / ");
}
