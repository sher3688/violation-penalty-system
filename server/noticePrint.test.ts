import { describe, expect, it } from "vitest";
import { formatNoticeRegulationBasis } from "../shared/noticePrint";

describe("formatNoticeRegulationBasis", () => {
  it("保留案件設定的法源依據，並去除前後空白", () => {
    expect(formatNoticeRegulationBasis("  住戶規約第 12 條  ")).toBe("住戶規約第 12 條");
  });

  it("法源未設定或只有空白時，回退顯示住戶規約", () => {
    expect(formatNoticeRegulationBasis(undefined)).toBe("住戶規約");
    expect(formatNoticeRegulationBasis("   ")).toBe("住戶規約");
  });
});
