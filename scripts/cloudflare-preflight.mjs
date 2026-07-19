import { readFile } from "node:fs/promises";

const configText = await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const packageJson = JSON.parse(
  await readFile(new URL("../package.json", import.meta.url), "utf8")
);

const checks = [
  ["Cloudflare Worker 名稱", /"name"\s*:\s*"violation-penalty-system"/.test(configText)],
  ["Node.js 相容模式", configText.includes('"nodejs_compat"')],
  ["Hyperdrive 綁定", configText.includes('"binding": "HYPERDRIVE"')],
  ["MySQL 照片儲存模式", !configText.includes('"binding": "CASE_PHOTOS"')],
  ["mysql2 版本需求", Number((packageJson.dependencies.mysql2.match(/\d+/) ?? [0])[0]) >= 3],
  ["Hyperdrive 正式 ID", !configText.includes("REPLACE_WITH_YOUR_HYPERDRIVE_ID")],
];

for (const [label, passed] of checks) {
  console.log(`${passed ? "✓" : "✗"} ${label}`);
}

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  console.error("\nCloudflare 尚未完成正式資源設定，請先處理上方標示 ✗ 的項目。");
  process.exitCode = 1;
} else {
  console.log("\nCloudflare 設定檔已通過部署前檢查。");
  console.log("部署後請開啟 /api/health，確認 ready 為 true。");
}
