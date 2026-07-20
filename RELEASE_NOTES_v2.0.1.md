# V2.0.1 修正版

## 修正內容

- 移除 Cloudflare Worker 在每次 API 啟動時自動執行 `CREATE TABLE` 的行為。
- 改為只檢查既有 `users` 資料表是否可讀取。
- 避免正式 MySQL 帳號沒有 DDL 權限時，登入頁與所有 API 被 503 阻斷。
- 保留現有案件、照片、Excel、ZIP、PDF 與登入功能。

## 部署說明

此版本不會刪除、重建或修改現有資料表與案件資料。資料庫結構變更應透過正式 migration 在部署階段執行。
