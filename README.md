# CircleAI

一個專為資訊安全分析師設計的 AI 驅動 Chrome 擴展，能夠快速分析選定文本並解碼 Base64 字符串。

## 🎯 專案主軸

CircleAI 是一個專業的網頁安全分析工具，旨在提升資訊安全專家的工作效率。透過整合多種 AI 服務和智能解碼功能，讓安全分析師能夠在瀏覽網頁時即時獲得深度分析和解碼支援。

### 核心價值
- **效率提升**：一鍵選擇文本即可獲得 AI 分析，無需切換工具
- **專業導向**：專為資訊安全領域設計的功能和分析角度
- **多層解碼**：支援遞歸 Base64 解碼和歷史導航
- **穩定可靠**：增強的連接機制確保擴展穩定運行

## ✨ 主要功能

### 🤖 AI 智能分析
- **即時分析**：選擇任何網頁文本，立即獲得 AI 驅動的安全分析
- **多 AI 支援**：支援 OpenAI、Google Gemini、Anthropic Claude、Grok (xAI) 和自定義 API
- **自定義模型**：每個提供商都支援自定義模型名稱
- **安全導向**：專為網路安全專業人士優化的分析角度

### 🔓 Base64 解碼系統
- **智能檢測**：自動識別並標記有效的 Base64 字符串（最小 40 字符）
- **遞歸解碼**：支援多層 Base64 編碼的自動遞歸解碼
- **歷史導航**：解碼歷史記錄功能，可在多層解碼結果間自由導航
- **精確驗證**：嚴格的 Base64 格式驗證，減少誤判
- **批量處理**：單次最多檢測 5 個 Base64 字符串，避免界面混亂
![b64Decode](https://github.com/poligogo/CircleAI/blob/main/video/b64_DecodeVideo.gif)


### 🛡️ 穩定性保障
- **連接監控**：實時監控擴展連接狀態
- **自動重試**：3 次重試機制，每次間隔 1 秒
- **智能提醒**：檢測到連接問題時自動顯示解決方案
- **保活機制**：增強的 Service Worker 保活系統

### 🎨 現代化界面
- **漸層主題**：美觀的紫色漸層設計
- **響應式設計**：適配不同螢幕尺寸
- **流暢動畫**：平滑的過渡效果和互動反饋
- **直觀操作**：簡潔明瞭的用戶界面

## 📦 安裝方式

### 開發者模式安裝
1. 複製此儲存庫或下載原始碼
2. 開啟 Chrome 瀏覽器，導航至 `chrome://extensions/`
3. 在右上角啟用「開發者模式」
4. 點擊「載入未封裝項目」並選擇擴展目錄
5. CircleAI 擴展現在應該出現在您的擴展列表中

### 首次設定檢查
- 確保擴展已正確載入且圖標顯示在工具列
- 如遇到連接問題，請重新載入擴展並刷新頁面

## ⚙️ 配置設定

### API 配置
1. 點擊 Chrome 工具列中的 CircleAI 擴展圖標
2. 配置您偏好的 AI 提供商和 API 金鑰：
   - **OpenAI**: 需要 API 金鑰（支援 GPT-4、GPT-3.5 等）
   - **Google Gemini**: 需要 API 金鑰（支援 Gemini Pro、Gemini Pro Vision）
   - **Anthropic Claude**: 需要 API 金鑰（支援 Claude-3、Claude-2）
   - **Grok (xAI)**: 需要 API 金鑰（支援 Grok-1）
   - **自定義 API**: 配置您自己的端點
3. 可選：為每個提供商設定自定義模型名稱
4. 儲存您的配置

### 安全建議
- API 金鑰僅儲存在本地瀏覽器中，不會上傳至任何伺服器
- 建議定期更換 API 金鑰以確保安全性

## 🚀 使用方法

### AI 智能分析
1. 導航至任何網頁
2. 選擇您想要分析的文本
3. 右鍵點擊並從上下文選單中選擇「使用 CircleAI 分析」
4. 等待 AI 分析結果在彈出視窗中顯示
5. 分析結果將包含安全相關的見解和建議

### Base64 解碼功能
1. 導航至任何網頁
2. 選擇包含 Base64 字符串的文本
3. 右鍵點擊並選擇「使用 CircleAI 解碼 Base64」
4. 擴展將自動檢測並解碼 Base64 字符串
5. 如果解碼內容包含更多 Base64，將提供遞歸解碼選項
6. 使用「返回」按鈕在解碼歷史間導航

### 新功能亮點
- **歷史導航**：在多層解碼結果間自由切換
- **智能檢測**：只標記真正有效的 Base64 字符串
- **批量處理**：一次處理多個 Base64 字符串
- **連接監控**：自動檢測並解決連接問題

## 🔌 支援的 AI 提供商

### OpenAI
- **模型**: GPT-4、GPT-3.5-turbo 或任何自定義模型
- **API 金鑰**: 需要從 OpenAI 平台獲取
- **端點**: https://api.openai.com/v1/chat/completions
- **特色**: 強大的語言理解和生成能力

### Google Gemini
- **模型**: gemini-pro、gemini-pro-vision 或任何自定義模型
- **API 金鑰**: 需要從 Google AI Studio 獲取
- **端點**: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
- **特色**: 多模態支援，優秀的推理能力

### Anthropic Claude
- **模型**: claude-3-opus-20240229、claude-3-sonnet-20240229、claude-3-haiku-20240307 或任何自定義模型
- **API 金鑰**: 需要從 Anthropic Console 獲取
- **端點**: https://api.anthropic.com/v1/messages
- **特色**: 安全性導向，優秀的分析能力

### Grok (xAI)
- **模型**: grok-beta 或任何自定義模型
- **API 金鑰**: 需要從 xAI 平台獲取
- **端點**: https://api.x.ai/v1/chat/completions
- **特色**: 實時資訊整合，幽默風格

### 自定義 API
- **端點**: 配置您自己的 API 端點
- **標頭**: 根據需要設定自定義標頭
- **模型**: 指定您的自定義模型名稱
- **特色**: 完全自定義，支援企業內部 AI 服務

## 🧪 測試方法

### 方法一：使用本地 HTTP 伺服器（推薦）

1. 執行測試伺服器：
   ```bash
   python3 start_server.py
   ```
2. 瀏覽器將自動開啟 `http://localhost:8000/test_page.html`
3. 測試擴展功能

### 方法二：直接檔案存取

1. 直接在 Chrome 中開啟 `test_page.html`
2. **重要**：您可能需要為 CircleAI 擴展啟用「允許存取檔案網址」：
   - 前往 `chrome://extensions/`
   - 找到 CircleAI 擴展
   - 點擊「詳細資料」
   - 啟用「允許存取檔案網址」

### 功能測試
1. 開啟 `test_page.html` 在您的瀏覽器中
2. 嘗試選擇不同的文本樣本進行 AI 分析
3. 測試 AI 分析和 Base64 解碼功能
4. 驗證擴展與您配置的 AI 提供商正常工作

### Base64 檢測測試
1. 開啟 `test_base64_detection.html` 測試頁面
2. 測試各種 Base64 字符串的檢測準確性
3. 驗證遞歸解碼和歷史導航功能
4. 確認誤判率已降低

### 連接穩定性測試
1. 在不同網站上測試擴展功能
2. 重新載入擴展後測試連接恢復
3. 驗證自動重試機制
4. 測試刷新提醒功能

## 🔧 故障排除

如果您看到「擴展上下文無效」錯誤：

1. **重新載入擴展**：
   - 前往 `chrome://extensions/`
   - 點擊 CircleAI 的重新載入按鈕
   - 刷新測試頁面

2. **使用 HTTP 伺服器而非 file:// 協議**：
   - 使用提供的 `start_server.py` 腳本
   - 或使用任何本地 HTTP 伺服器（Live Server 等）

3. **檢查控制台錯誤**：
   - 開啟開發者工具 (F12)
   - 檢查 Console 標籤的錯誤訊息
   - 查看 CircleAI 除錯訊息

### 常見問題

#### 擴展連接問題
- **症狀**: 顯示「擴展連接已中斷」
- **解決方案**: 
  1. 前往 `chrome://extensions/`
  2. 找到 CircleAI 並點擊重新載入按鈕
  3. 刷新當前網頁
  4. 如問題持續，請重啟瀏覽器

#### API 錯誤
- **症狀**: 無法獲得 AI 回應
- **解決方案**:
  1. 檢查 API 金鑰是否正確
  2. 確認網路連接正常
  3. 驗證 AI 提供商服務狀態
  4. 使用「測試連接」功能驗證設定

#### Base64 檢測問題
- **症狀**: 無法檢測到 Base64 字符串
- **解決方案**:
  1. 確保字符串長度至少 40 個字符
  2. 檢查字符串格式是否符合 Base64 標準
  3. 驗證字符串不包含無效字符

### 除錯模式

啟用除錯模式：
1. 開啟 Chrome 開發者工具 (F12)
2. 前往 Console 標籤
3. 查看 CircleAI 除錯訊息
4. 檢查錯誤日誌和連接狀態

### 重置設定

重置所有設定：
1. 前往 `chrome://extensions/`
2. 找到 CircleAI 並點擊「詳細資料」
3. 點擊「擴展選項」
4. 使用重置功能或清除瀏覽器儲存

## 📋 API 配置範例

### OpenAI 配置
```json
{
  "provider": "openai",
  "apiKey": "sk-your-openai-api-key",
  "model": "gpt-4",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### Google Gemini 配置
```json
{
  "provider": "gemini",
  "apiKey": "your-gemini-api-key",
  "model": "gemini-pro",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### Anthropic Claude 配置
```json
{
  "provider": "anthropic",
  "apiKey": "sk-ant-your-anthropic-api-key",
  "model": "claude-3-sonnet-20240229",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### Grok (xAI) 配置
```json
{
  "provider": "grok",
  "apiKey": "xai-your-grok-api-key",
  "model": "grok-beta",
  "temperature": 0.7,
  "maxTokens": 1000
}
```

### 自定義 API 配置
```json
{
  "provider": "custom",
  "apiKey": "your-custom-api-key",
  "endpoint": "https://your-api-endpoint.com/v1/chat/completions",
  "model": "your-custom-model",
  "temperature": 0.7,
  "maxTokens": 1000,
  "headers": {
    "Authorization": "Bearer your-token",
    "Custom-Header": "custom-value"
  }
}
```

## 🔒 隱私與安全

### 資料保護
- **本地儲存**：所有 API 金鑰僅儲存在您的瀏覽器本地
- **無伺服器傳輸**：我們不會收集或傳輸您的任何資料
- **直接通訊**：文本分析直接與您選擇的 AI 提供商進行
- **最小權限**：擴展僅與您配置的 AI 提供商通訊

### 安全建議
- 定期更換 API 金鑰
- 僅在信任的網站上使用擴展
- 注意敏感資訊的分析內容
- 建議使用具有適當權限限制的 API 金鑰

## 🚀 未來發展

### 計劃功能
- **更多編碼格式**：支援 URL 編碼、十六進制等
- **批量分析**：同時分析多個文本片段
- **自定義提示**：允許用戶自定義 AI 分析提示
- **結果匯出**：支援分析結果的匯出功能
- **主題自定義**：更多 UI 主題選擇

### 技術改進
- **效能優化**：減少記憶體使用和提升回應速度
- **離線模式**：支援本地 AI 模型
- **多語言支援**：介面本地化
- **快捷鍵**：鍵盤快捷鍵支援

## 🤝 貢獻指南

歡迎貢獻！請遵循以下步驟：

1. Fork 此專案
2. 建立功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交變更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 開啟 Pull Request

### 開發環境設定
1. 確保已安裝 Chrome 瀏覽器
2. 啟用開發者模式
3. 載入未封裝的擴展
4. 使用提供的測試頁面進行測試

## 📄 許可證

MIT License - 詳見 LICENSE 檔案

---

**CircleAI** - 讓資訊安全分析更智能、更高效 🛡️✨

如有問題或建議，歡迎提交 Issue 或聯繫開發團隊。
