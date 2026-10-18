export const parsePositiveSafeInteger = (value: unknown): number | null => {
  if (typeof value === "string" && !/^[1-9]\d*$/.test(value)) return null;
  if (typeof value !== "string" && typeof value !== "number") return null;

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};
