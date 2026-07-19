# 違規罰單管理系統 V2 beta 3

## 本次完成

1. 已填入正式 Cloudflare Hyperdrive 設定 ID。
2. 配合完全免費部署要求，取消 Cloudflare R2 訂閱需求。
3. 新增 MySQL `case_photo_objects` 照片資料表，照片與案件資料共用 Aiven 免費 MySQL。
4. Worker 上傳、讀取與刪除照片會在沒有 R2 時自動使用 MySQL。
5. 保留 R2 相容能力，未來需要擴充容量時仍可切換，不影響現有案件操作。
6. 更新部署前檢查與健康檢查，確認免費 MySQL 照片模式可用。

## 驗證結果

- TypeScript 型別檢查：通過。
- 自動測試：12 個測試檔、40 項測試全部通過。
- Cloudflare 部署前設定檢查：全部通過。
- MySQL 照片資料表 migration：已產生。

## 注意事項

- Aiven 免費方案為 1 GB；每筆案件仍限制最多兩張照片。
- 正式使用時應避免上傳不必要的超大原始照片，後續會再加入瀏覽器端壓縮以延長免費容量。
