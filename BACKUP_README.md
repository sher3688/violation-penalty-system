# 違規開罰管理系統備份說明

此備份對應 **2026-07-18** 的可交付版本，包含通知單雙聯外框移除、管理員依月份直接下載罰單紀錄 PDF、依日期區間匯出每戶違規金額 Excel 統計，以及相關測試與驗證紀錄。壓縮檔以原始碼與可重建設定為主，不納入可由套件管理器或建置流程重新產生的資料夾，也不包含任何環境變數、登入工作階段或執行紀錄。

| 項目 | 備份內容 | 還原方式 |
| --- | --- | --- |
| 前端與頁面 | `client/`，包含通知單列印、月度 PDF 匯出頁與每戶金額 Excel 統計頁 | 解壓後執行 `pnpm install` |
| 後端與資料模型 | `server/`、`drizzle/`、`shared/`，包含每戶違規金額彙總查詢與 Excel 匯出資料格式 | 依既有環境變數設定資料庫後執行建置 |
| 專案設定 | `package.json`、`pnpm-lock.yaml`、TypeScript、Vite 與 Drizzle 設定 | 執行 `pnpm install` 後使用 `pnpm check` 驗證 |
| 測試與驗收紀錄 | `server/*.test.ts`、`pdf-validation-notes.md`、`visual-validation.md` 與 PDF 實作來源說明 | 執行 `pnpm test`；需要時執行 `pnpm tsx verify_monthly_penalty_pdf.tsx` |
| 實際 PDF 驗證檔 | `validation-artifacts/monthly-penalty-export-verification.pdf` | 可直接開啟，檢視 31 筆測試案件的五頁 A4 匯出成果 |
| 字型資產 | `static-assets/NotoSansCJKtc-Regular.otf` | 匯回 Manus 專案時，以靜態資產上傳流程重新取得網址，並更新 `client/src/lib/monthlyPenaltyPdf.tsx` 的 `FONT_SOURCE` 常數 |

備份刻意排除 `node_modules/`、`dist/`、`.git/`、`.manus-logs/`、任何 `.env` 檔案及暫存輸出。這些內容可能包含可重建檔案、執行期間資料或敏感資訊，並非安全備份所必需。

## 快速驗證

解壓縮後，先在專案根目錄安裝相依套件，再依序執行下列指令：

```bash
pnpm install
pnpm check
pnpm test
pnpm build
```

管理員登入後，可由側欄進入「每月罰單 PDF 匯出」選定月份並直接下載對應 PDF，也可由「每戶違規金額 Excel」設定日期區間並下載各戶案件數、應收、已繳與未繳金額統計。PDF 與 Excel 產製元件均採用動態載入，避免日常案件管理介面在未匯出前載入大型函式庫。
