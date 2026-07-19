# 社區違規開罰管理系統：自有主機部署指南

本系統是以 **Node.js 應用程式＋MySQL／MariaDB 資料庫** 為目標的全端網站，不適合只提供靜態 HTML、PHP 或 FTP 上傳的純靜態空間。請確認您的網頁空間可執行長駐的 Node.js 程序，或可透過主機控制台建立 Node.js 應用程式。系統已使用本機帳號密碼登入、受權限保護的照片檔案路由與 MySQL 資料表，不依賴任何平台專屬登入服務。

> **建議部署環境**：Node.js 22、pnpm 10、MySQL 8 或 MariaDB 10.6 以上，以及可供應用程式持久讀寫的照片目錄。若您的主機只有 PHP 或純靜態網站功能，請改用支援 Node.js 的 VPS、雲端應用程式主機或具 Node.js Application 功能的控制台。

| 元件 | 用途 | 部署要求 |
|---|---|---|
| Node.js 伺服器 | 提供 React 網頁、tRPC API、登入與受保護照片路由 | 可執行常駐程序與設定環境變數 |
| MySQL／MariaDB | 儲存帳號、案件、範本、繳款、申訴與統計來源資料 | 建立獨立資料庫與具 DDL/DML 權限的帳號 |
| 照片目錄 | 儲存違規現場照片 | 位於網站公開目錄外；執行帳號具讀寫權限 |
| HTTPS 反向代理 | 對外提供安全網站並轉送到 Node.js 程序 | Nginx、Apache、cPanel Node.js App 或主機商的反向代理 |

## 1. 部署前準備

請將專案完整上傳或以 Git 取得到主機，例如 `/var/www/community-violation`。建議不要把 `node_modules`、本機開發日誌、`uploads` 測試檔或任何含密碼的檔案提交到版本庫。主機的執行帳號必須能讀取專案目錄，並能寫入您指定的照片儲存位置。

建立資料庫與最小權限使用者後，請設定資料庫編碼為 `utf8mb4`。以下是概念範例，帳密請改用主機提供的值：

```sql
CREATE DATABASE community_violation CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'community_app'@'127.0.0.1' IDENTIFIED BY '請改為高強度密碼';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP ON community_violation.* TO 'community_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

若資料庫與應用程式不在同一台主機，請依主機商規則將資料庫連線來源限制為該應用程式的內部網路或固定出口 IP。

## 2. 設定環境變數

請參考專案根目錄的 `deployment.env.template.txt`，將下列值設定於主機控制台、程序管理工具或正式環境檔。**不可直接使用範例中的密碼與密鑰。**

| 變數 | 必填 | 說明 |
|---|---:|---|
| `DATABASE_URL` | 是 | MySQL 連線字串，例如 `mysql://user:password@127.0.0.1:3306/community_violation?charset=utf8mb4`；密碼中的特殊字元必須 URL 編碼。 |
| `LOCAL_AUTH_SECRET` | 是 | 至少 32 個字元的高熵隨機密鑰，用於簽署 12 小時登入工作階段。可用密碼管理工具產生。 |
| `NODE_ENV` | 是 | 正式環境固定為 `production`。這會啟用安全 Cookie。 |
| `PORT` | 視主機而定 | Node.js 程序的內部連接埠，例如 `3000`；部分主機會自動提供。 |
| `UPLOAD_DIR` | 是 | 永久照片目錄的絕對路徑，例如 `/var/lib/community-violation/uploads`。務必位於公開網站根目錄外。 |

建立照片目錄並指派給應用程式執行帳號：

```bash
sudo install -d -m 750 -o <app-user> -g <app-group> /var/lib/community-violation/uploads
```

系統僅接受 JPEG、PNG、WebP 三種圖片格式，每張最多 8 MB、每案最多 6 張。照片透過受登入與戶別權限檢查的 `/api/files/:storageKey` 路由讀取，不會被直接公開為靜態檔。

## 3. 安裝、遷移與建置

在專案根目錄執行下列命令。若使用 npm 而非 pnpm，請以等價命令安裝；專案鎖定檔以 pnpm 為準。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm build
```

`pnpm drizzle-kit migrate` 會套用專案內的資料庫遷移，建立使用者、住戶、違規項目範本、違規案件、案件照片、繳款與申訴等資料表。執行前請先確認 `DATABASE_URL` 指向正確的正式資料庫；首次上線前建議先於測試資料庫演練。

完成建置後，可用下列方式啟動：

```bash
NODE_ENV=production pnpm start
```

正式環境的啟動檔會是 `dist/index.js`。應用程式會同時提供前端靜態檔案與後端 API，因此不需要另行部署 SPA 靜態站點。

## 4. 常見主機架構

### cPanel 或主機控制台的 Node.js Application

請在控制台建立 Node.js 應用程式，將應用程式根目錄指向專案根目錄，設定 Node.js 版本為 22，並在控制台填入前述環境變數。啟動指令可使用 `pnpm start`，或由控制台指定 `dist/index.js` 為啟動檔。若控制台會管理連接埠，請勿自行對外開放內部 `PORT`；將網域或子網域綁定到該應用程式即可。

### VPS＋Nginx 反向代理

請使用程序管理工具讓 Node.js 程序常駐，並由 Nginx 轉送 HTTPS 流量至內部連接埠。概念設定如下；憑證設定請使用您的正式網域與主機既有流程：

```nginx
server {
  listen 443 ssl http2;
  server_name violations.example.com;

  client_max_body_size 52m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

`client_max_body_size` 應高於六張 8 MB 照片的總上傳需求。應用程式層仍會限制單張 8 MB 與每案六張照片。

## 5. 首次啟用與帳號管理

首次開啟網站時，系統會顯示「首次管理員設定」頁面。請建立第一位管理員帳號並使用長度至少 10 個字元的密碼。完成後，管理員可於「住戶與帳號」頁建立住戶帳號、綁定戶號，並啟用或停用帳號。

| 角色 | 可執行操作 |
|---|---|
| 管理員 | 建立案件、上傳照片、建立違規項目範本、列印通知單、登錄繳款、審核申訴、管理住戶帳號、查看統計。 |
| 一般住戶 | 僅能檢視與自己綁定戶號相符的案件與照片，並可針對自己的案件提交申訴。 |

違規項目可先由管理員在「違規項目範本」維護名稱、預設說明、住戶規約法源與建議罰款。建立新案件時可選擇範本自動帶入內容，仍可針對個案修改後再儲存。

## 6. A4 列印操作

案件明細頁可開啟列印預覽。列印頁使用 **A4 直向、上半部罰單聯、下半部留存聯** 的固定版面，並顯示法源依據「住戶規約」、戶號、違規說明、現場照片、罰款、簽收欄與管理單位簽章欄。

請在瀏覽器列印對話框選擇：

| 設定 | 建議值 |
|---|---|
| 紙張大小 | A4 |
| 方向 | 直向 |
| 邊界 | 無或最小 |
| 背景圖形 | 依管理單位需要選擇；黑白列印亦保留框線與文字內容 |
| 縮放 | 100% 或預設 |

## 7. 維運、備份與更新

請每日備份資料庫，並同步備份 `UPLOAD_DIR` 目錄；案件資料與照片必須成對保存。更新程式前先建立資料庫備份與照片目錄快照，接著執行安裝、遷移、建置並重啟程序：

```bash
pnpm install --frozen-lockfile
pnpm drizzle-kit migrate
pnpm build
# 依您的主機工具重啟 Node.js 程序
```

請勿在生產環境刪除仍有案件關聯的照片檔案；若需要刪除案件或照片，應先制定保留年限與書面管理規則。登入 Cookie 在 HTTPS 正式環境中會以 `Secure` 與 `HttpOnly` 屬性傳送，因此正式網域必須完成 HTTPS 設定。

## 8. 上線驗收清單

在實際使用前，請以一位測試管理員及一位測試住戶完成以下驗收：

- 建立違規項目範本，並確認它可在新案件表單選單中帶入說明、法源與罰款。
- 建立一筆含照片的案件，確認案件清單、戶號篩選及案件詳情正確。
- 開啟 A4 預覽並以實體印表機或「另存 PDF」檢查上下雙聯、裁切虛線與照片比例。
- 以住戶帳號登入，確認只能看到已綁定戶號的案件與照片，並可提交申訴。
- 以管理員帳號審核申訴、登錄繳款、變更狀態及檢視統計報表。
- 確認資料庫與 `UPLOAD_DIR` 皆被納入備份作業。

如需轉移主機，請先停止寫入、備份資料庫與照片目錄、在新主機完成環境變數與資料庫遷移，最後再還原資料與切換網域。
