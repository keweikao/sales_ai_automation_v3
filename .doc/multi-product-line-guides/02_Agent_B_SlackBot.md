# Agent B: Slack Bot 動態表單系統 - 執行指南

> **Agent**: B  
> **優先級**: 🔴 高  
> **時程**: 8-10 小時  
> **責任**: Channel 解析 + 動態表單 + File Upload 整合

---

## 📋 目錄

- [依賴項](#依賴項)
- [詳細任務清單](#詳細任務清單)
- [驗收檢查點](#驗收檢查點)
- [常見問題](#常見問題)

---

## 依賴項

### ✅ 必須依賴

**Agent A 的交付物**:
- `ProductLineConfig` interface
- `getProductConfig()` 函數
- `ProductLine` 類型

### 🔧 如果 Agent A 未完成

可以使用以下 Mock 繼續開發:

```typescript
// Temporary Mock
type ProductLine = 'ichef' | 'beauty';

interface ProductLineConfig {
  id: ProductLine;
  displayName: string;
  formFields: {
    storeType: { label: string; options: Array<{value: string; label: string}> };
    serviceType?: { label: string; options: Array<{value: string; label: string}> };
    staffCount?: { label: string; options: Array<{value: string; label: string}> };
    currentSystem: { label: string; options: Array<{value: string; label: string}> };
  };
}

function getProductConfig(productLine: ProductLine): ProductLineConfig {
  // Mock implementation
  return productLine === 'beauty' ? beautyMockConfig : ichefMockConfig;
}
```

---

## 📊 你的交付物

完成後,你需要提供:

### 1. Channel 解析器
```typescript
// /apps/slack-bot/src/utils/product-line-resolver.ts
export function resolveProductLine(channelId: string, env: Env): ProductLine;
```

### 2. 動態表單生成器
```typescript
// /apps/slack-bot/src/utils/form-builder.ts
export function buildAudioUploadModal(
  pendingFile: PendingAudioFile,
  productLine: ProductLine
): SlackModalView;
```

### 3. File Upload 整合
- 修改後的 `file.ts` (支援 productLine)
- 更新的 `types.ts` (擴展 metadata)

---

## 📋 詳細任務清單

### 階段 1: Channel 解析 (2h)

#### 任務 1.1: 創建 product-line-resolver.ts (1h)

創建 `/apps/slack-bot/src/utils/product-line-resolver.ts`:

```typescript
/**
 * Product Line Resolver
 * 根據 Slack Channel ID 解析產品線
 */

import type { ProductLine } from '@Sales_ai_automation_v3/shared/product-configs';
import type { Env } from '../types';

/**
 * 從環境變數解析產品線配置
 * 
 * 環境變數格式: PRODUCT_LINE_CHANNELS='{"C12345":"ichef","C67890":"beauty"}'
 * 
 * @param channelId - Slack Channel ID
 * @param env - Environment variables
 * @returns ProductLine ('ichef' | 'beauty')
 */
export function resolveProductLine(channelId: string, env: Env): ProductLine {
  try {
    // 讀取環境變數
    const configJson = env.PRODUCT_LINE_CHANNELS;
    
    // 如果未設定環境變數,預設為 'ichef' (向後相容)
    if (!configJson) {
      console.log('[ProductLineResolver] No PRODUCT_LINE_CHANNELS configured, defaulting to ichef');
      return 'ichef';
    }

    // 解析 JSON
    const channelMap: Record<string, ProductLine> = JSON.parse(configJson);
    
    // 查找 Channel 對應的產品線
    const productLine = channelMap[channelId];
    
    if (productLine) {
      console.log(`[ProductLineResolver] Channel ${channelId} -> ${productLine}`);
      return productLine;
    }
    
    // 如果 Channel 未配置,預設為 'ichef' (向後相容)
    console.log(`[ProductLineResolver] Channel ${channelId} not configured, defaulting to ichef`);
    return 'ichef';
    
  } catch (error) {
    // 解析錯誤時預設為 'ichef' (安全降級)
    console.error('[ProductLineResolver] Failed to parse PRODUCT_LINE_CHANNELS:', error);
    console.log('[ProductLineResolver] Defaulting to ichef due to error');
    return 'ichef';
  }
}

/**
 * 驗證環境變數配置是否正確
 * 
 * @param env - Environment variables
 * @returns 驗證結果
 */
export function validateProductLineConfig(env: Env): {
  valid: boolean;
  error?: string;
  channelCount?: number;
} {
  try {
    const configJson = env.PRODUCT_LINE_CHANNELS;
    
    if (!configJson) {
      return {
        valid: true,
        channelCount: 0,
      };
    }

    const channelMap = JSON.parse(configJson);
    
    // 檢查是否為物件
    if (typeof channelMap !== 'object' || Array.isArray(channelMap)) {
      return {
        valid: false,
        error: 'PRODUCT_LINE_CHANNELS must be a JSON object',
      };
    }

    // 檢查每個值是否為有效的 ProductLine
    const validProductLines: ProductLine[] = ['ichef', 'beauty'];
    for (const [channel, productLine] of Object.entries(channelMap)) {
      if (!validProductLines.includes(productLine as ProductLine)) {
        return {
          valid: false,
          error: `Invalid product line "${productLine}" for channel ${channel}`,
        };
      }
    }

    return {
      valid: true,
      channelCount: Object.keys(channelMap).length,
    };
    
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
```

**驗證**:
```typescript
// 測試
const env = { PRODUCT_LINE_CHANNELS: '{"C12345":"ichef","C67890":"beauty"}' };
console.log(resolveProductLine('C12345', env)); // 'ichef'
console.log(resolveProductLine('C67890', env)); // 'beauty'
console.log(resolveProductLine('C99999', env)); // 'ichef' (fallback)
```

---

#### 任務 1.2: 測試 Channel 解析器 (30 min)

創建 `/apps/slack-bot/src/utils/__tests__/product-line-resolver.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { resolveProductLine, validateProductLineConfig } from '../product-line-resolver';

describe('ProductLineResolver', () => {
  describe('resolveProductLine', () => {
    it('should return ichef for configured channel', () => {
      const env = { PRODUCT_LINE_CHANNELS: '{"C12345":"ichef"}' };
      expect(resolveProductLine('C12345', env)).toBe('ichef');
    });

    it('should return beauty for configured channel', () => {
      const env = { PRODUCT_LINE_CHANNELS: '{"C67890":"beauty"}' };
      expect(resolveProductLine('C67890', env)).toBe('beauty');
    });

    it('should default to ichef for unconfigured channel', () => {
      const env = { PRODUCT_LINE_CHANNELS: '{"C12345":"ichef"}' };
      expect(resolveProductLine('C99999', env)).toBe('ichef');
    });

    it('should default to ichef when no config', () => {
      const env = {};
      expect(resolveProductLine('C12345', env)).toBe('ichef');
    });

    it('should default to ichef on parse error', () => {
      const env = { PRODUCT_LINE_CHANNELS: 'invalid json' };
      expect(resolveProductLine('C12345', env)).toBe('ichef');
    });
  });

  describe('validateProductLineConfig', () => {
    it('should validate correct config', () => {
      const env = { PRODUCT_LINE_CHANNELS: '{"C12345":"ichef","C67890":"beauty"}' };
      const result = validateProductLineConfig(env);
      expect(result.valid).toBe(true);
      expect(result.channelCount).toBe(2);
    });

    it('should reject invalid product line', () => {
      const env = { PRODUCT_LINE_CHANNELS: '{"C12345":"invalid"}' };
      const result = validateProductLineConfig(env);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid product line');
    });

    it('should handle empty config', () => {
      const env = {};
      const result = validateProductLineConfig(env);
      expect(result.valid).toBe(true);
      expect(result.channelCount).toBe(0);
    });
  });
});
```

**執行測試**:
```bash
bun run test apps/slack-bot/src/utils/__tests__/product-line-resolver.test.ts
```

---

### 階段 2: 表單生成器 (4-5h)

#### 任務 2.1: 創建 form-builder.ts (2.5h)

創建 `/apps/slack-bot/src/utils/form-builder.ts`:

```typescript
/**
 * Dynamic Form Builder
 * 根據產品線動態生成 Slack Modal 表單
 */

import { getProductConfig, type ProductLine } from '@Sales_ai_automation_v3/shared/product-configs';
import type { PendingAudioFile, AudioUploadMetadata } from '../types';

/**
 * 建立文字輸入欄位
 */
function buildTextInput(blockId: string, label: string, required: boolean = true) {
  return {
    type: 'input',
    block_id: blockId,
    label: {
      type: 'plain_text',
      text: label,
    },
    element: {
      type: 'plain_text_input',
      action_id: blockId,
    },
    optional: !required,
  };
}

/**
 * 建立選擇欄位
 */
function buildSelectInput(
  blockId: string,
  label: string,
  options: Array<{ value: string; label: string; emoji?: string }>,
  required: boolean = true
) {
  return {
    type: 'input',
    block_id: blockId,
    label: {
      type: 'plain_text',
      text: label,
    },
    element: {
      type: 'static_select',
      action_id: blockId,
      placeholder: {
        type: 'plain_text',
        text: `選擇${label}`,
      },
      options: options.map(opt => ({
        text: {
          type: 'plain_text',
          text: opt.emoji ? `${opt.emoji} ${opt.label}` : opt.label,
        },
        value: opt.value,
      })),
    },
    optional: !required,
  };
}

/**
 * 建立音檔上傳 Modal
 * 
 * @param pendingFile - 待處理的音檔資訊
 * @param productLine - 產品線 ('ichef' | 'beauty')
 * @returns Slack Modal View
 */
export function buildAudioUploadModal(
  pendingFile: PendingAudioFile,
  productLine: ProductLine
) {
  const config = getProductConfig(productLine);
  
  // 通用欄位
  const commonBlocks = [
    buildTextInput('customer_number', '客戶編號', true),
    buildTextInput('customer_name', '客戶名稱', true),
  ];

  // 產品線特定欄位
  const productBlocks = [
    // 店鋪類型 (所有產品線都有)
    buildSelectInput(
      'store_type',
      config.formFields.storeType.label,
      config.formFields.storeType.options,
      config.formFields.storeType.required ?? true
    ),
  ];

  // iCHEF: 營運型態
  if (productLine === 'ichef' && config.formFields.serviceType) {
    productBlocks.push(
      buildSelectInput(
        'service_type',
        config.formFields.serviceType.label,
        config.formFields.serviceType.options,
        config.formFields.serviceType.required ?? true
      )
    );
  }

  // Beauty: 員工數量
  if (productLine === 'beauty' && config.formFields.staffCount) {
    productBlocks.push(
      buildSelectInput(
        'staff_count',
        config.formFields.staffCount.label,
        config.formFields.staffCount.options,
        config.formFields.staffCount.required ?? true
      )
    );
  }

  // 現有系統 (所有產品線都有)
  productBlocks.push(
    buildSelectInput(
      'current_system',
      config.formFields.currentSystem.label,
      config.formFields.currentSystem.options,
      config.formFields.currentSystem.required ?? true
    )
  );

  // 決策者在場
  const additionalBlocks = [
    buildSelectInput(
      'decision_maker_present',
      '決策者在場',
      [
        { value: 'yes', label: '是', emoji: '✅' },
        { value: 'no', label: '否', emoji: '❌' },
        { value: 'unknown', label: '不確定', emoji: '❓' },
      ],
      false
    ),
  ];

  return {
    type: 'modal',
    callback_id: 'audio_upload_form',
    title: {
      type: 'plain_text',
      text: `${config.displayName} - 音檔資訊`,
    },
    submit: {
      type: 'plain_text',
      text: '提交',
    },
    close: {
      type: 'plain_text',
      text: '取消',
    },
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*檔案名稱:* ${pendingFile.name}\n*檔案大小:* ${(pendingFile.size / 1024 / 1024).toFixed(2)} MB`,
        },
      },
      {
        type: 'divider',
      },
      ...commonBlocks,
      ...productBlocks,
      ...additionalBlocks,
    ],
    private_metadata: JSON.stringify({
      fileId: pendingFile.id,
      fileName: pendingFile.name,
      fileUrl: pendingFile.url,
      productLine, // 重要: 儲存產品線資訊
    }),
  };
}

/**
 * 解析表單提交的值
 * 
 * @param values - Slack 表單值
 * @param productLine - 產品線
 * @returns 解析後的 metadata
 */
export function parseAudioUploadFormValues(
  values: any,
  productLine: ProductLine
): Partial<AudioUploadMetadata> {
  const metadata: Partial<AudioUploadMetadata> = {
    productLine, // 加入產品線
    customerNumber: values.customer_number?.customer_number?.value,
    customerName: values.customer_name?.customer_name?.value,
    storeType: values.store_type?.store_type?.selected_option?.value,
    currentSystem: values.current_system?.current_system?.selected_option?.value,
    decisionMakerPresent: values.decision_maker_present?.decision_maker_present?.selected_option?.value,
  };

  // iCHEF 特定欄位
  if (productLine === 'ichef') {
    metadata.serviceType = values.service_type?.service_type?.selected_option?.value;
  }

  // Beauty 特定欄位
  if (productLine === 'beauty') {
    metadata.staffCount = values.staff_count?.staff_count?.selected_option?.value;
  }

  return metadata;
}
```

---

#### 任務 2.2: 測試表單生成器 (1h)

創建測試文件並驗證:

```typescript
// /apps/slack-bot/src/utils/__tests__/form-builder.test.ts
import { describe, expect, it } from 'vitest';
import { buildAudioUploadModal, parseAudioUploadFormValues } from '../form-builder';

describe('FormBuilder', () => {
  const mockFile = {
    id: 'F12345',
    name: 'test.mp3',
    url: 'https://...',
    size: 1024000,
  };

  describe('buildAudioUploadModal', () => {
    it('should build iCHEF modal', () => {
      const modal = buildAudioUploadModal(mockFile, 'ichef');
      expect(modal.title.text).toContain('iCHEF');
      
      // 檢查欄位
      const blockIds = modal.blocks
        .filter(b => b.type === 'input')
        .map(b => b.block_id);
      
      expect(blockIds).toContain('store_type');
      expect(blockIds).toContain('service_type'); // iCHEF only
      expect(blockIds).not.toContain('staff_count'); // Beauty only
    });

    it('should build Beauty modal', () => {
      const modal = buildAudioUploadModal(mockFile, 'beauty');
      expect(modal.title.text).toContain('美業');
      
      const blockIds = modal.blocks
        .filter(b => b.type === 'input')
        .map(b => b.block_id);
      
      expect(blockIds).toContain('store_type');
      expect(blockIds).toContain('staff_count'); // Beauty only
      expect(blockIds).not.toContain('service_type'); // iCHEF only
    });

    it('should include productLine in private_metadata', () => {
      const modal = buildAudioUploadModal(mockFile, 'beauty');
      const metadata = JSON.parse(modal.private_metadata);
      expect(metadata.productLine).toBe('beauty');
    });
  });

  describe('parseAudioUploadFormValues', () => {
    it('should parse iCHEF form values', () => {
      const values = {
        customer_number: { customer_number: { value: 'CUST-001' } },
        customer_name: { customer_name: { value: 'Test Shop' } },
        store_type: { store_type: { selected_option: { value: 'coffee_shop' } } },
        service_type: { service_type: { selected_option: { value: 'dine_in' } } },
        current_system: { current_system: { selected_option: { value: 'none' } } },
      };

      const metadata = parseAudioUploadFormValues(values, 'ichef');
      expect(metadata.productLine).toBe('ichef');
      expect(metadata.serviceType).toBe('dine_in');
      expect(metadata.staffCount).toBeUndefined(); // Beauty only
    });

    it('should parse Beauty form values', () => {
      const values = {
        customer_number: { customer_number: { value: 'CUST-002' } },
        customer_name: { customer_name: { value: 'Beauty Salon' } },
        store_type: { store_type: { selected_option: { value: 'hair_salon' } } },
        staff_count: { staff_count: { selected_option: { value: '4-10' } } },
        current_system: { current_system: { selected_option: { value: 'excel' } } },
      };

      const metadata = parseAudioUploadFormValues(values, 'beauty');
      expect(metadata.productLine).toBe('beauty');
      expect(metadata.staffCount).toBe('4-10');
      expect(metadata.serviceType).toBeUndefined(); // iCHEF only
    });
  });
});
```

---

### 階段 3: File Upload 整合 (2-3h)

#### 任務 3.1: 更新 types.ts (30 min)

編輯 `/apps/slack-bot/src/types.ts`:

```typescript
import type { ProductLine } from '@Sales_ai_automation_v3/shared/product-configs';

// 現有的 Env interface
export interface Env {
  SLACK_BOT_TOKEN: string;
  SLACK_SIGNING_SECRET: string;
  API_BASE_URL: string;
  API_SERVICE_ACCOUNT_KEY: string;
  
  // 新增: 產品線 Channel 配置
  PRODUCT_LINE_CHANNELS?: string; // JSON string: {"C12345":"ichef","C67890":"beauty"}
}

// 擴展 AudioUploadMetadata
export interface AudioUploadMetadata {
  // 通用欄位
  customerNumber: string;
  customerName: string;
  
  // 產品線 (新增)
  productLine?: ProductLine;
  
  // iCHEF 欄位
  storeType?: string;
  serviceType?: string; // iCHEF only
  currentPos?: string; // 舊欄位名稱,保留相容性
  
  // Beauty 欄位
  beautyType?: string; // 店鋪類型 (Beauty)
  staffCount?: string; // Beauty only
  currentBeautySystem?: string; // Beauty 現有系統
  
  // 通用欄位
  currentSystem?: string; // 新欄位名稱
  decisionMakerPresent?: string;
  
  // 音檔資訊
  duration?: number;
  format?: string;
  conversationDate?: string;
}

// PendingAudioFile (保持不變)
export interface PendingAudioFile {
  id: string;
  name: string;
  url: string;
  size: number;
  mimetype?: string;
}
```

---

#### 任務 3.2: 修改 file.ts (1.5-2h)

編輯 `/apps/slack-bot/src/events/file.ts`:

**修改重點**:
1. 在 `handleFileSharedEvent()` 中解析 productLine
2. 使用 `buildAudioUploadModal()` 生成表單
3. 在表單提交時解析 productLine
4. 傳遞 productLine 到 API

```typescript
import { resolveProductLine } from '../utils/product-line-resolver';
import { buildAudioUploadModal, parseAudioUploadFormValues } from '../utils/form-builder';

/**
 * 處理檔案分享事件
 */
export async function handleFileSharedEvent(
  event: SlackEvent,
  env: Env
): Promise<void> {
  console.log(`[FileEvent] Starting handleFileSharedEvent for file_id: ${event.file_id}`);

  const fileId = event.file_id;
  if (!fileId) {
    console.log("[FileEvent] No file_id in file_shared event");
    return;
  }

  const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);
  
  // 取得檔案資訊
  const fileInfo = await slackClient.getFileInfo(fileId);
  if (!(fileInfo.ok && fileInfo.file)) {
    console.error(`[FileEvent] Failed to get file info: ${fileInfo.error}`);
    return;
  }

  const file = fileInfo.file;
  
  // 檢查是否為音檔
  const isAudioFile = /* ... 現有檢查邏輯 ... */;
  if (!isAudioFile) {
    console.log(`[FileEvent] File is not audio, skipping`);
    return;
  }

  // ⭐ 新增: 解析產品線
  const channelId = event.channel_id || file.channels?.[0];
  const productLine = resolveProductLine(channelId, env);
  console.log(`[FileEvent] Resolved productLine: ${productLine} for channel: ${channelId}`);

  // ⭐ 修改: 使用動態表單生成器
  const pendingFile: PendingAudioFile = {
    id: file.id,
    name: file.name,
    url: file.url_private,
    size: file.size,
    mimetype: file.mimetype,
  };

  const modal = buildAudioUploadModal(pendingFile, productLine);

  // 發送 Modal
  try {
    await slackClient.openModal(event.user, modal);
    console.log(`[FileEvent] Modal opened for user ${event.user}`);
  } catch (error) {
    console.error(`[FileEvent] Failed to open modal:`, error);
  }
}

/**
 * 處理 Modal 提交
 */
export async function handleAudioUploadSubmit(
  payload: any,
  env: Env
): Promise<void> {
  console.log(`[FileEvent] Handling audio upload form submission`);

  const values = payload.view.state.values;
  const privateMetadata = JSON.parse(payload.view.private_metadata);
  
  // ⭐ 新增: 從 private_metadata 取得 productLine
  const productLine = privateMetadata.productLine || 'ichef';
  console.log(`[FileEvent] Form submission for productLine: ${productLine}`);

  // ⭐ 修改: 使用動態表單解析器
  const metadata = parseAudioUploadFormValues(values, productLine);

  // 準備 API 請求
  const apiClient = new ApiClient(env.API_BASE_URL, env.API_SERVICE_ACCOUNT_KEY);

  try {
    const result = await apiClient.uploadConversation({
      opportunityId: /* ... */,
      slackFileUrl: privateMetadata.fileUrl,
      slackBotToken: env.SLACK_BOT_TOKEN,
      title: `${metadata.customerName} - ${new Date().toLocaleDateString('zh-TW')}`,
      type: 'demo',
      metadata: {
        ...metadata,
        productLine, // ⭐ 重要: 傳遞 productLine
        fileName: privateMetadata.fileName,
        fileSize: /* ... */,
      },
      slackUser: {
        id: payload.user.id,
        username: payload.user.username,
      },
    });

    console.log(`[FileEvent] Upload successful: ${result.conversationId}`);
    
    // 發送確認訊息
    const slackClient = new SlackClient(env.SLACK_BOT_TOKEN);
    await slackClient.sendMessage({
      channel: payload.user.id,
      text: `✅ 音檔已上傳 (${productLine === 'beauty' ? '美業' : 'iCHEF'})`,
    });
    
  } catch (error) {
    console.error(`[FileEvent] Upload failed:`, error);
    throw error;
  }
}
```

---

### 階段 4: 測試 (1h)

#### 任務 4.1: 單元測試 (30 min)

確保所有單元測試通過:

```bash
bun run test apps/slack-bot
```

#### 任務 4.2: 整合測試計畫 (30 min)

準備實際 Slack 測試:

1. **測試環境設定**
   ```bash
   # 不設定 PRODUCT_LINE_CHANNELS (測試向後相容)
   wrangler secret put PRODUCT_LINE_CHANNELS
   # 輸入: (留空,按 Enter)
   ```

2. **測試場景 1: 未設定環境變數**
   - 在任何 Channel 上傳音檔
   - 預期: 顯示 iCHEF 表單
   - 驗證: metadata.productLine = 'ichef'

3. **測試場景 2: 設定環境變數**
   ```bash
   wrangler secret put PRODUCT_LINE_CHANNELS
   # 輸入: {"C12345ICHEF":"ichef","C67890BEAUTY":"beauty"}
   ```
   - 在 iCHEF Channel 上傳 → iCHEF 表單
   - 在 Beauty Channel 上傳 → Beauty 表單

---

## ✅ 驗收檢查點 2A - Agent B

### 📋 功能驗收

#### 測試 1: Channel 解析 (未設定環境變數)

```typescript
// 測試程式碼
import { resolveProductLine } from './product-line-resolver';

const env = {}; // 未設定
const result = resolveProductLine('C123456', env);

console.log('Result:', result);
// 預期: 'ichef'
```

**結果**: [ ] 通過 (必須返回 'ichef')

---

#### 測試 2: Channel 解析 (已設定環境變數)

```typescript
const env = {
  PRODUCT_LINE_CHANNELS: '{"C12345":"ichef","C67890":"beauty"}'
};

console.log(resolveProductLine('C12345', env)); // 預期: 'ichef'
console.log(resolveProductLine('C67890', env)); // 預期: 'beauty'
console.log(resolveProductLine('C99999', env)); // 預期: 'ichef' (fallback)
```

**結果**: [ ] 通過

---

#### 測試 3: 表單生成 (iCHEF)

```typescript
import { buildAudioUploadModal } from './form-builder';

const mockFile = { id: 'F1', name: 'test.mp3', url: '...', size: 1000000 };
const modal = buildAudioUploadModal(mockFile, 'ichef');

// 檢查欄位
const blockIds = modal.blocks
  .filter(b => b.type === 'input')
  .map(b => b.block_id);

console.log('Has store_type:', blockIds.includes('store_type'));       // 應該 true
console.log('Has service_type:', blockIds.includes('service_type'));   // 應該 true (iCHEF)
console.log('Has staff_count:', blockIds.includes('staff_count'));     // 應該 false (Beauty only)
```

**結果**: [ ] 通過

---

#### 測試 4: 表單生成 (Beauty)

```typescript
const modal = buildAudioUploadModal(mockFile, 'beauty');

const blockIds = modal.blocks
  .filter(b => b.type === 'input')
  .map(b => b.block_id);

console.log('Has store_type:', blockIds.includes('store_type'));       // 應該 true
console.log('Has staff_count:', blockIds.includes('staff_count'));     // 應該 true (Beauty)
console.log('Has service_type:', blockIds.includes('service_type'));   // 應該 false (iCHEF only)
```

**結果**: [ ] 通過

---

### ⚠️ 向後相容性驗收 (最關鍵!)

#### 測試 5: 未設定環境變數時的行為

**測試場景**:
```
1. 完全不設定 PRODUCT_LINE_CHANNELS
2. 在 Slack 中上傳音檔
```

**預期行為**:
- ✅ 顯示 iCHEF 表單 (店型、營運型態、現有POS)
- ✅ 提交後 metadata.productLine = 'ichef'
- ✅ 與現有流程完全相同
- ✅ 使用者無感知變化

**驗證方式**:
```bash
# 1. 部署到測試環境 (不設定環境變數)
cd apps/slack-bot
wrangler deploy --env staging

# 2. 檢查環境變數
wrangler secret list
# 應該沒有 PRODUCT_LINE_CHANNELS

# 3. 在 Slack 測試 Channel 上傳音檔
# 4. 檢查表單欄位
# 5. 提交後檢查 DB
```

**實際測試記錄**:
- [ ] 表單顯示正確 (iCHEF 欄位)
- [ ] metadata.productLine = 'ichef'
- [ ] 與之前表單相同

**結果**: [ ] 通過

---

### 🧪 品質驗收

- [ ] TypeScript 編譯無錯誤: `bun run check-types`
- [ ] 單元測試通過: `bun run test apps/slack-bot`
- [ ] Linting 通過: `bun x ultracite check`
- [ ] 測試覆蓋率 > 80%

---

### 📊 性能驗收

#### 測試 6: 表單生成時間

```typescript
import { performance } from 'perf_hooks';

const start = performance.now();
buildAudioUploadModal(mockFile, 'ichef');
const end = performance.now();

console.log(`Generation time: ${end - start}ms`);
// 預期: < 100ms
```

**結果**: [ ] 通過

---

#### 測試 7: 產品線解析時間

```typescript
const start = performance.now();
resolveProductLine('C12345', env);
const end = performance.now();

console.log(`Resolution time: ${end - start}ms`);
// 預期: < 10ms
```

**結果**: [ ] 通過

---

## 🚫 不通過標準

如果以下任一條件不符合,**必須修正**:

- ❌ 未設定環境變數時,不是預設 'ichef'
- ❌ TypeScript 編譯錯誤
- ❌ 單元測試失敗
- ❌ iCHEF 表單缺少必要欄位
- ❌ Beauty 表單缺少必要欄位
- ❌ 向後相容性測試失敗

---

## 常見問題

### Q: 如何測試不同的 Channel?
A: 使用 Slack 建立測試 Channel,記錄 Channel ID,然後在環境變數中配置。

### Q: 環境變數格式錯誤怎麼辦?
A: 系統會自動 fallback 到 'ichef',檢查 logs 會看到解析錯誤訊息。

### Q: 如何驗證向後相容性?
A: 最簡單的方式是不設定環境變數,確認系統行為與之前完全相同。

---

**完成後**: 通知 Agent D,Slack Bot 已支援產品線! 🎉
