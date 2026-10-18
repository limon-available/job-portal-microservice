import { describe, expect, it } from "vitest";
import { parsePositiveSafeInteger } from "../lib/job-wizard-id.js";

describe("parsePositiveSafeInteger", () => {
  it.each([12, "12"])("parses API IDs represented as %s", (value) => {
    expect(parsePositiveSafeInteger(value)).toBe(12);
  });

  it.each([0, -1, "0", "012", "1.2", "invalid", Number.MAX_SAFE_INTEGER + 1, null])(
    "rejects invalid ID %s",
    (value) => {
      expect(parsePositiveSafeInteger(value)).toBeNull();
    },
  );
});
