import { describe, expect, it } from "vitest";
import {
  classifyGradeStage,
  EGYPT_K12_EXTRA_GRADES,
  pickPreferredDefaultGradeId,
} from "@/domain/academic/k12";

describe("K-12 grade stage classification & defaults", () => {
  it("classifies Primary 1..6, Prep 1..3, Secondary General, and Baccalaureate accurately", () => {
    expect(classifyGradeStage("PRIM_1")).toBe("primary");
    expect(classifyGradeStage("PRIM_6")).toBe("primary");
    expect(classifyGradeStage("PREP_3")).toBe("preparatory");
    expect(classifyGradeStage("SEC_1")).toBe("secondary_general");
    expect(classifyGradeStage("SEC_3_GEN")).toBe("secondary_general");
    expect(classifyGradeStage("SEC_2_BACC")).toBe("baccalaureate");
  });

  it("defines complete Egypt K-12 supplementary grades from Primary 1 to Secondary 3", () => {
    const codes = EGYPT_K12_EXTRA_GRADES.map((g) => g.code);
    expect(codes).toContain("PRIM_1");
    expect(codes).toContain("PRIM_6");
    expect(codes).toContain("PREP_1");
    expect(codes).toContain("PREP_3");
    expect(codes).toContain("SEC_1");
    expect(codes).toContain("SEC_3_GEN");
    expect(EGYPT_K12_EXTRA_GRADES.length).toBe(11);
  });

  it("prefers SEC_2_BACC when picking the default selected grade", () => {
    const picked = pickPreferredDefaultGradeId([
      { id: "g1", code: "PRIM_1" },
      { id: "g2", code: "SEC_2_BACC" },
      { id: "g3", code: "SEC_3_GEN" },
    ]);
    expect(picked).toBe("g2");
  });
});
