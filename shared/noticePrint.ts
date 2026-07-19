export function formatNoticeRegulationBasis(regulationBasis: string | null | undefined) {
  const normalized = regulationBasis?.trim();
  return normalized || "住戶規約";
}
