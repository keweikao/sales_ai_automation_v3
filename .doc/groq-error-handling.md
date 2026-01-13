# Groq Whisper API 錯誤處理文檔

> **最後更新**: 2026-01-13
> **版本**: V3
> **檔案**: [packages/services/src/transcription/groq-whisper.ts](../packages/services/src/transcription/groq-whisper.ts)

---

## 📋 改進摘要

為 Groq Whisper 轉錄服務提供**清楚的中文錯誤訊息**,與 Gemini API 錯誤處理保持一致的格式,確保使用者在出錯時清楚知道原因和解決方法。

### ✅ 核心改進

1. **統一的錯誤訊息格式**
   - 與 Gemini API 錯誤處理一致
   - 所有錯誤都有中文說明和解決建議

2. **音檔特定錯誤處理**
   - 音檔過大、格式錯誤等常見問題的清楚說明
   - 提供具體的檔案大小限制 (25MB)

3. **增強的錯誤物件**
   - 保留原始錯誤屬性
   - 添加清楚的中文訊息

---

## 🎯 錯誤分類與處理

### 1️⃣ 認證錯誤

| 錯誤類型 | 錯誤訊息 | HTTP 狀態 |
|---------|---------|-----------|
| 無效的 API Key | ❌ API Key 無效 - 請檢查 GROQ_API_KEY 環境變數是否正確設定 | 401 |
| 認證失敗 | [401] 認證失敗 - API Key 無效或缺失 | 401 |
| 權限不足 | [403] 存取被拒絕 - 沒有權限使用此服務 | 403 |

**解決方法**:
```bash
# 1. 檢查 .env 檔案
cat apps/server/.env | grep GROQ_API_KEY

# 2. 前往 Groq Console 生成新 Key
open https://console.groq.com/keys

# 3. 更新 .env 檔案
echo "GROQ_API_KEY=your-new-key-here" >> apps/server/.env
```

---

### 2️⃣ 配額與限流錯誤

| 錯誤類型 | 錯誤訊息 | 建議動作 |
|---------|---------|---------|
| 配額用盡 | ⚠️ 配額已用盡 - 請稍後再試或升級您的 Groq API 方案 | 等待重置或升級 |
| 請求頻率過高 | ⚠️ 請求頻率過高 - 請降低請求速度 | 實作請求隊列 |
| HTTP 429 限流 | [429] 請求過於頻繁 - 已達速率限制 | 增加延遲時間 |

**解決方法**:
- **配額用盡**: 等待重置或升級 Groq 方案
- **頻率限制**: 實作請求隊列或批次處理

---

### 3️⃣ 音檔相關錯誤 ⭐ (Groq 特有)

| 錯誤類型 | 錯誤訊息 | 解決方法 |
|---------|---------|---------|
| 音檔過大 | ❌ 音檔過大 - 最大限制 25MB,請使用 chunkIfNeeded: true | 啟用自動分塊 |
| HTTP 413 | [413] 音檔過大 - 請使用較小的檔案或啟用分塊處理 | 壓縮音檔 |
| 無效格式 | ❌ 請求參數錯誤 - Unsupported audio format | 轉換格式 |

**自動分塊處理範例**:
```typescript
import { createGroqWhisperService } from "./groq-whisper.js";

const service = createGroqWhisperService();

// 自動處理大於 24MB 的音檔
const result = await service.transcribe(largeAudioBuffer, {
  language: "zh",
  chunkIfNeeded: true,  // ✅ 自動分塊
});
```

**支援的音檔格式**:
- ✅ MP3
- ✅ WAV
- ✅ M4A
- ✅ OGG
- ✅ FLAC
- ✅ WEBM

---

### 4️⃣ 模型與資源錯誤

| 錯誤類型 | 錯誤訊息 |
|---------|---------|
| 找不到模型 | ❌ 找不到模型 - 請確認模型名稱: whisper-large-v3-turbo |
| 資源不存在 | [404] 找不到資源 - 請確認 API 端點正確 |

**當前使用模型**: `whisper-large-v3-turbo`

---

### 5️⃣ 伺服器錯誤

| 錯誤類型 | 錯誤訊息 | HTTP 狀態 |
|---------|---------|-----------|
| 內部錯誤 | [500] Groq 伺服器內部錯誤 | 500 |
| Gateway 錯誤 | [502] Groq 伺服器無回應 | 502 |
| 服務無法使用 | [503] Groq 服務暫時無法使用 | 503 |

---

## 🔧 實作細節

### 新增的錯誤處理方法

#### `enhanceGroqError()`
```typescript
private enhanceGroqError(error: unknown): Error {
  const message = this.formatGroqErrorMessage(error);
  const enhancedError = new Error(message);

  // 保留原始錯誤屬性
  if (error && typeof error === "object") {
    Object.assign(enhancedError, error);
  }

  return enhancedError;
}
```

#### `formatGroqErrorMessage()`
```typescript
private formatGroqErrorMessage(error: unknown): string {
  // 處理 Groq SDK 特定錯誤結構
  if (err.error) {
    switch (err.error.type) {
      case "invalid_api_key":
        return "❌ API Key 無效 - 請檢查 GROQ_API_KEY 環境變數是否正確設定";
      case "file_too_large":
        return "❌ 音檔過大 - 最大限制 25MB,請使用 chunkIfNeeded: true";
      // ... 更多錯誤類型
    }
  }

  // 處理 HTTP 狀態碼
  // 處理通用錯誤訊息模式
}
```

---

## 📊 與 Gemini 錯誤處理的對比

| 特性 | Gemini API | Groq Whisper |
|------|-----------|--------------|
| 中文錯誤訊息 | ✅ | ✅ |
| HTTP 狀態碼處理 | ✅ | ✅ |
| SDK 特定錯誤 | ✅ errorDetails | ✅ error.type |
| 錯誤訊息格式 | `[狀態碼] 訊息: 詳情` | `[狀態碼] 訊息: 詳情` |
| Emoji 提示 | ✅ ❌⚠️ | ✅ ❌⚠️ |
| 特定領域錯誤 | API Key, 模型 | 音檔格式, 大小 |

**一致性**: 兩者使用相同的錯誤訊息格式和 Emoji 標記

---

## 🎓 使用範例

### 範例 1: 基本錯誤處理

```typescript
import { createGroqWhisperService } from "./groq-whisper.js";

try {
  const service = createGroqWhisperService("INVALID_KEY");
  const result = await service.transcribe(audioBuffer);
} catch (error) {
  // 清楚的錯誤訊息:
  // ❌ API Key 無效 - 請檢查 GROQ_API_KEY 環境變數是否正確設定
  console.error(error.message);

  // 提示使用者如何修復
  console.log("請前往 https://console.groq.com/keys 生成新的 API Key");
}
```

### 範例 2: 處理音檔過大錯誤

```typescript
import { createGroqWhisperService } from "./groq-whisper.js";

const service = createGroqWhisperService();

try {
  // 嘗試轉錄大型音檔
  const result = await service.transcribe(largeAudioBuffer, {
    chunkIfNeeded: false,  // 關閉自動分塊
  });
} catch (error) {
  if (error.message.includes("音檔過大")) {
    console.log("音檔太大,啟用自動分塊重試...");

    // 啟用自動分塊重試
    const result = await service.transcribe(largeAudioBuffer, {
      chunkIfNeeded: true,  // ✅ 啟用自動分塊
    });
  } else {
    throw error;
  }
}
```

### 範例 3: 批次轉錄錯誤處理

```typescript
const audioFiles = [file1, file2, file3];
const results = [];
const errors = [];

for (const file of audioFiles) {
  try {
    const result = await service.transcribe(file);
    results.push(result);
  } catch (error) {
    // 記錄錯誤但繼續處理其他檔案
    errors.push({
      file: file.name,
      error: error.message,
    });
  }
}

console.log(`成功: ${results.length}, 失敗: ${errors.length}`);

if (errors.length > 0) {
  console.log("失敗的檔案:");
  for (const { file, error } of errors) {
    console.log(`  - ${file}: ${error}`);
  }
}
```

---

## 🔍 除錯指南

### 常見問題與解決方法

#### 1. API Key 相關錯誤

**錯誤訊息**: `❌ API Key 無效 - 請檢查 GROQ_API_KEY 環境變數是否正確設定`

**檢查清單**:
```bash
# 1. 確認環境變數存在
echo $GROQ_API_KEY

# 2. 檢查 .env 檔案
cat apps/server/.env | grep GROQ_API_KEY

# 3. 驗證 Key 格式 (應以 gsk_ 開頭)
# GROQ_API_KEY=gsk_xxxxxxxxxxxxxx
```

#### 2. 音檔過大錯誤

**錯誤訊息**: `❌ 音檔過大 - 最大限制 25MB,請使用 chunkIfNeeded: true`

**解決方案**:
```typescript
// 方法 1: 啟用自動分塊 (推薦)
const result = await service.transcribe(buffer, {
  chunkIfNeeded: true,
});

// 方法 2: 壓縮音檔
// 使用 ffmpeg 或其他工具降低位元率

// 方法 3: 分段處理
// 手動分割音檔為多個較小的片段
```

#### 3. 配額用盡錯誤

**錯誤訊息**: `⚠️ 配額已用盡 - 請稍後再試或升級您的 Groq API 方案`

**檢查配額**:
1. 登入 Groq Console: https://console.groq.com
2. 查看 Usage 頁面
3. 確認當前配額使用情況

**解決方法**:
- 等待配額重置 (通常每月重置)
- 升級到付費方案
- 優化音檔 (降低長度或位元率)

#### 4. 無效的音檔格式

**錯誤訊息**: `❌ 請求參數錯誤 - Unsupported audio format`

**檢查與修正**:
```bash
# 檢查音檔格式
file audio.mp3

# 轉換為支援的格式 (使用 ffmpeg)
ffmpeg -i input.wav -ar 16000 -ac 1 -b:a 64k output.mp3
```

---

## 📈 效能最佳化建議

### 1. 使用自動分塊處理大型音檔

```typescript
// ✅ 推薦: 自動處理大型檔案
const result = await service.transcribe(buffer, {
  chunkIfNeeded: true,  // 超過 24MB 自動分塊
  language: "zh",
});

// ❌ 不推薦: 手動判斷
if (buffer.length > 24_000_000) {
  // 手動分塊邏輯...
}
```

### 2. 批次處理多個音檔

```typescript
// ✅ 並行處理 (注意 API 限流)
const results = await Promise.all(
  audioBuffers.slice(0, 5).map(buffer =>
    service.transcribe(buffer, { language: "zh" })
  )
);

// ⚠️ 如遇到限流,改為序列處理
for (const buffer of audioBuffers) {
  const result = await service.transcribe(buffer);
  await new Promise(resolve => setTimeout(resolve, 1000)); // 延遲 1 秒
}
```

### 3. 音檔預處理

```bash
# 降低位元率以減少檔案大小
ffmpeg -i input.mp3 -ar 16000 -ac 1 -b:a 32k output.mp3

# 分割長音檔
ffmpeg -i long_audio.mp3 -f segment -segment_time 600 -c copy part_%03d.mp3
```

---

## ✅ 測試驗證

### 測試檔案

**[test-groq-error-handling.ts](../packages/services/src/transcription/test-groq-error-handling.ts)**

### 執行測試

```bash
tsx packages/services/src/transcription/test-groq-error-handling.ts
```

### 測試覆蓋

✅ **認證錯誤** (3 種)
✅ **配額與限流錯誤** (3 種)
✅ **音檔相關錯誤** (3 種)
✅ **模型與資源錯誤** (2 種)
✅ **伺服器錯誤** (3 種)

**總計**: 14 種錯誤類型,全部通過測試

---

## 📚 API 參考

### GroqWhisperService

```typescript
class GroqWhisperService {
  // 公開方法
  transcribe(audioBuffer: Buffer, options?: TranscriptionOptions): Promise<TranscriptResult>
  shouldChunk(buffer: Buffer): boolean

  // 錯誤處理方法 (私有)
  private enhanceGroqError(error: unknown): Error
  private formatGroqErrorMessage(error: unknown): string
}
```

### TranscriptionOptions

```typescript
interface TranscriptionOptions {
  language?: string;              // 預設: "zh"
  chunkIfNeeded?: boolean;        // 預設: true
  responseFormat?: string;        // 預設: "verbose_json"
  temperature?: number;           // 預設: 0.0
}
```

---

## 🔗 相關資源

- [Groq API 文檔](https://console.groq.com/docs)
- [Whisper Model 說明](https://github.com/openai/whisper)
- [Gemini 錯誤處理文檔](./error-handling-improvements.md)

---

## ✨ 總結

### 改進成果

✅ **100% 錯誤都有清楚的中文說明**
✅ **音檔特定錯誤處理完善**
✅ **與 Gemini API 錯誤格式一致**
✅ **提供具體的解決方法**
✅ **完整的測試覆蓋**

### 使用者體驗提升

- ❌ 之前: "Error: Invalid file format"
- ✅ 現在: "❌ 請求參數錯誤 - Unsupported audio format。請確認音檔格式 (支援 MP3, WAV, M4A 等)"

**清楚、可操作、友善!** 🎉
