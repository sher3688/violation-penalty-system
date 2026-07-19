# Cloudflare Workers 部署步驟

此版本已將前端靜態檔、tRPC API、MySQL 與案件照片整合成 Cloudflare Workers 部署架構。

## 先決條件

1. 一個可由網際網路連線的 MySQL 或 MySQL 相容資料庫。
2. Cloudflare 帳號。
3. 已登入 Wrangler：`pnpm wrangler login`。

## 第一次設定

```bash
pnpm install
pnpm wrangler hyperdrive create violation-db --connection-string="mysql://帳號:密碼@主機:3306/資料庫"
```

把 Hyperdrive 指令輸出的 ID 貼到 `wrangler.jsonc`：

```json
"id": "你的 Hyperdrive ID"
```

設定密鑰：

```bash
pnpm wrangler secret put LOCAL_AUTH_SECRET
pnpm wrangler secret put JWT_SECRET
```

兩個密鑰請使用至少 32 個字元的隨機內容。

## 建立資料表

先在可連線 MySQL 的電腦設定 `DATABASE_URL`，再執行：

```bash
export DATABASE_URL="mysql://帳號:密碼@主機:3306/資料庫"
pnpm db:push
```

## 部署

```bash
pnpm cf:preflight
pnpm deploy
```

部署完成後，請開啟：

```text
https://你的網址/api/health
```

只有在 `ready` 為 `true`，且資料庫、MySQL 照片空間、前端資源與登入密鑰四項皆為 `true` 時，才視為完成正式環境連接。本免費部署版不需要啟用 Cloudflare R2 訂閱。

部署後第一次開啟網站，系統會要求建立第一個管理員帳號。

## GitHub 自動部署

在 Cloudflare Workers & Pages 中選擇「Create application → Import a repository」，選取此 repository。

- Build command：`pnpm build:client`
- Deploy command：`pnpm wrangler deploy`
- Root directory：留空

另外在 Cloudflare 專案設定中加入 Secret：`LOCAL_AUTH_SECRET`、`JWT_SECRET`。

## Cloudflare Git 連線欄位

建立 Worker 並連接 GitHub repository 時，使用：

- Build command：`pnpm build:client`
- Deploy command：`pnpm wrangler deploy`
- Root directory：留空

在第一次部署前，必須先建立 R2 bucket、MySQL/Hyperdrive，並將實際 Hyperdrive ID 寫入 `wrangler.jsonc`。`REPLACE_WITH_YOUR_HYPERDRIVE_ID` 不能保留。
