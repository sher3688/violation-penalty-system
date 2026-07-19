# 月度罰單 PDF 實作來源紀錄

- [React PDF 字型文件](https://react-pdf.org/fonts)：確認可透過 `Font.register` 註冊遠端 URL 或 Node 絕對路徑的字型，並以字型家族套用至文件元件。
- [React PDF 進階文件](https://react-pdf.org/advanced)：確認 Web 端可使用 `pdf(document).toBlob()` 取得實際 PDF Blob；文件亦說明 `Page` 支援自動換頁、`fixed` 元件可做每頁頁尾與頁碼。
- [Noto CJK 官方儲存庫](https://github.com/notofonts/noto-cjk)：採用繁體中文靜態字型 `Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf`，下載來源為 <https://raw.githubusercontent.com/notofonts/noto-cjk/main/Sans/OTF/TraditionalChinese/NotoSansCJKtc-Regular.otf>。

> 字型格式在實際 PDF 產製驗證腳本中載入；如該執行環境不支援 OTF，應改用相容的靜態 TTF 或 WOFF 字型後再交付。
