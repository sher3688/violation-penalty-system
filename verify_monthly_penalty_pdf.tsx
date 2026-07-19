import { createElement } from "react";
import { renderToFile } from "@react-pdf/renderer";
import {
  MonthlyPenaltyPdfDocument,
  registerMonthlyPenaltyPdfFont,
} from "./client/src/lib/monthlyPenaltyPdf";

const outputPath = "/home/ubuntu/monthly-penalty-export-verification.pdf";

const cases = Array.from({ length: 31 }, (_, index) => ({
  id: index + 1,
  noticeNo: `V202607-${String(index + 1).padStart(4, "0")}`,
  householdNo: `B${(index % 9) + 1}-${String((index % 20) + 1).padStart(2, "0")}F`,
  violationType: index % 2 === 0 ? "公共空間堆置雜物" : "違規停車",
  location: index % 2 === 0 ? "一樓公共走道" : "地下二樓停車場",
  occurredAt: new Date(2026, 6, (index % 28) + 1, 9, 30),
  penaltyAmount: index % 3 === 0 ? 1000 : 500,
  status: index % 4 === 0 ? "paid" : "pending_payment",
}));

async function main() {
  registerMonthlyPenaltyPdfFont("/home/ubuntu/webdev-static-assets/NotoSansCJKtc-Regular.otf");
  await renderToFile(
    createElement(MonthlyPenaltyPdfDocument, {
      month: "2026-07",
      cases,
      generatedAt: new Date(2026, 6, 18),
    }),
    outputPath
  );
  console.log(outputPath);
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
