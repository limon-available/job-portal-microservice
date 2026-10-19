import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sql: vi.fn<(...args: [TemplateStringsArray, ...unknown[]]) => Promise<unknown[]>>(),
}));

vi.mock("../utils/db.js", () => ({ sql: mocks.sql }));

const repository = await import("../repositories/jobs.js");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sql
    .mockResolvedValueOnce([{ job_id: 12, company_name: "Acme" }])
    .mockResolvedValueOnce([{ total: 1 }]);
});

describe("job search repository", () => {
  it("matches keyword searches against company names and counts those results", async () => {
    const result = await repository.searchJobs({
      keyword: "Acme",
      skills: [],
      sort: "newest",
      limit: 12,
      offset: 0,
    });

    expect(result).toEqual({
      jobs: [{ job_id: 12, company_name: "Acme" }],
      total: 1,
    });

    const searchQuery = Array.from(mocks.sql.mock.calls[0]?.[0] ?? []).join("");
    const countQuery = Array.from(mocks.sql.mock.calls[1]?.[0] ?? []).join("");
    for (const query of [searchQuery, countQuery]) {
      expect(query).toContain("JOIN companies c ON c.company_id=j.company_id");
      expect(query).toContain("c.name ILIKE");
      expect(query).toContain("to_tsvector('english'");
    }
  });
});
