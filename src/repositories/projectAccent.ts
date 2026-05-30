export const PROJECT_ACCENTS = ["bg-emerald-500", "bg-sky-500", "bg-amber-500", "bg-rose-500", "bg-violet-500"] as const;

export function projectAccentAt(index: number) {
  return PROJECT_ACCENTS[index % PROJECT_ACCENTS.length];
}

export function normalizeProjectAccent(accent: string | undefined, fallbackIndex: number): string {
  return PROJECT_ACCENTS.includes(accent as (typeof PROJECT_ACCENTS)[number])
    ? (accent as string)
    : projectAccentAt(fallbackIndex);
}

export function rowCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? count : 0;
}
