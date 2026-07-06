import { describe, expect, it } from "vitest";
import { calculateWamFromUnitResults } from "./academicResults";

describe("calculateWamFromUnitResults", () => {
  it("calculates WAM from all counted numeric unit attempts", () => {
    const result = calculateWamFromUnitResults([
      {
        counted: true,
        creditPoints: 10,
        grade: "D",
        mark: 71,
        notes: "Exit award",
        title: "Managing Globally",
        unitCode: "MGMT8015",
      },
      {
        counted: true,
        creditPoints: 10,
        grade: "Cr",
        mark: 66,
        notes: "Exit award",
        title: "Marketing Management",
        unitCode: "MKTG8001",
      },
      {
        counted: true,
        creditPoints: 10,
        grade: "P",
        mark: 58,
        notes: "Exit award",
        title: "Business Economics",
        unitCode: "ECON8040",
      },
      {
        counted: true,
        creditPoints: 10,
        grade: "S",
        mark: null,
        notes: "Exit award",
        title: "Business Professional Practice",
        unitCode: "BUSN8001",
      },
      {
        counted: true,
        creditPoints: 10,
        grade: "F",
        mark: 41,
        notes: "Masters only",
        title: "International Trade and Finance",
        unitCode: "IBUS8020",
      },
      {
        counted: true,
        creditPoints: 10,
        grade: "W",
        mark: null,
        notes: "Masters only",
        title: "Strategy in Asia-Pacific Markets",
        unitCode: "MGMT8032",
      },
    ]);

    expect(result).toMatchObject({
      includedUnitCount: 4,
      totalCreditPoints: 40,
      totalWeightedPoints: 2360,
    });
    expect(result?.wam).toBe(59);
  });

  it("excludes transfer, exemption, advanced-standing, and explicitly uncounted rows", () => {
    const result = calculateWamFromUnitResults([
      { counted: true, creditPoints: 6, grade: "HD", mark: 90 },
      { counted: true, creditPoints: 6, grade: "RPL", mark: 80 },
      { counted: true, creditPoints: 6, grade: "EX", mark: 80 },
      { counted: true, creditPoints: 6, grade: "CR", mark: 80, notes: "Advanced standing" },
      { counted: false, creditPoints: 6, grade: "D", mark: 80 },
    ]);

    expect(result).toMatchObject({
      includedUnitCount: 1,
      totalCreditPoints: 6,
      totalWeightedPoints: 540,
      wam: 90,
    });
  });
});

