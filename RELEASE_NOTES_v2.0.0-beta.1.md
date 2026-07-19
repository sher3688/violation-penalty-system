# 違規罰單管理系統 V2 beta 1

## V2 原則

- 保留 v1.3.2 的頁面、欄位與操作習慣。
- 保留案件新增、修改、刪除、編號排序、明細、照片、月份 PDF、Excel、月份 ZIP 封存與安全清理。
- 僅替換登入、資料庫連線、照片儲存與 Cloudflare 部署層。

## 本次完成

1. 修正 MySQL Hyperdrive 連線在正式建置時的型別衝突。
2. 統一 Express 與 Cloudflare Workers 的登入 Cookie 回應介面。
3. 讓 Worker 直接由執行環境讀取資料庫與登入密鑰，不再修改唯讀的 `process.env.NODE_ENV`。
4. 修正照片刪除測試，使本機檔案與 Cloudflare R2 共用同一套清理流程。
5. 移除舊平台的分析碼占位符，修正正式建置警告，並將頁面語系設定為繁體中文。

## 驗證結果

- TypeScript 型別檢查：通過。
- 自動測試：11 個測試檔、38 項測試全部通過。
- 前端正式建置：通過。
- Cloudflare Worker dry-run 封裝：通過。

## 尚未進行

- 尚未連接正式 Hyperdrive、MySQL 與 R2。
- 尚未匯入正式案件資料與照片。
- 尚未對外部署；正式上線前仍需以實際 Cloudflare 資源完成端到端驗收。
