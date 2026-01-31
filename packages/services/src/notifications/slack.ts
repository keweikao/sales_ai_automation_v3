/**
 * Slack 通知服務實現
 * 提供統一的 Slack 通知功能
 */

import type { KnownBlock } from "@slack/web-api";
import { WebClient } from "@slack/web-api";
import {
  buildProcessingCompletedBlocks,
  buildProcessingFailedBlocks,
  buildProcessingStartedBlocks,
} from "./blocks.js";
import type {
  ProcessingCompletedParams,
  ProcessingFailedParams,
  ProcessingStartedParams,
  SlackNotificationConfig,
  SlackNotificationService,
} from "./types.js";

/**
 * Slack 通知服務實現類
 */
export class SlackNotificationServiceImpl implements SlackNotificationService {
  private readonly client: WebClient;

  constructor(config: SlackNotificationConfig) {
    this.client = new WebClient(config.token);
  }

  /**
   * 發送處理開始通知
   */
  async notifyProcessingStarted(
    params: ProcessingStartedParams
  ): Promise<string> {
    const blocks = buildProcessingStartedBlocks(
      params.fileName,
      params.fileSize,
      params.conversationId,
      params.caseNumber
    );

    const fallbackText =
      "🎬 開始處理音檔: " +
      params.fileName +
      " (" +
      (params.fileSize / 1024 / 1024).toFixed(2) +
      " MB)";

    // 返回訊息的 thread_ts (用於後續回覆)
    return await this.sendCustomMessage(params.userId, blocks, fallbackText);
  }

  /**
   * 發送處理完成通知
   */
  async notifyProcessingCompleted(
    params: ProcessingCompletedParams
  ): Promise<void> {
    const blocks = buildProcessingCompletedBlocks(
      params.caseNumber,
      params.conversationId,
      params.analysisResult,
      params.processingTimeMs,
      params.shareToken // 傳遞 shareToken
    );

    const fallbackText =
      "✅ 音檔處理完成 - 案件編號: " +
      params.caseNumber +
      " (PDCM 分數: " +
      params.analysisResult.overallScore +
      "/100)";

    // 如果有 threadTs 就在同一個 thread 內回覆
    await this.sendCustomMessage(
      params.userId,
      blocks,
      fallbackText,
      params.threadTs
    );
  }

  /**
   * 發送處理失敗通知
   */
  async notifyProcessingFailed(params: ProcessingFailedParams): Promise<void> {
    const blocks = buildProcessingFailedBlocks(
      params.fileName,
      params.errorMessage,
      params.caseNumber,
      params.retryCount
    );

    const fallbackText = `❌ 音檔處理失敗: ${params.fileName}`;

    // 如果有 threadTs 就在同一個 thread 內回覆
    await this.sendCustomMessage(
      params.userId,
      blocks,
      fallbackText,
      params.threadTs
    );
  }

  /**
   * 發送自訂訊息
   */
  async sendCustomMessage(
    channel: string,
    blocks: KnownBlock[],
    fallbackText: string,
    threadTs?: string
  ): Promise<string> {
    try {
      const result = await this.client.chat.postMessage({
        channel,
        blocks,
        text: fallbackText,
        thread_ts: threadTs, // 如果有 threadTs 就在該 thread 內回覆
      });

      // 返回訊息的 timestamp (用於建立 thread)
      return result.ts || "";
    } catch (error) {
      console.error("[SlackNotification] Failed to send message:", error);
      throw error;
    }
  }
}

/**
 * 創建 Slack 通知服務實例
 */
export function createSlackNotificationService(
  config: SlackNotificationConfig
): SlackNotificationService {
  return new SlackNotificationServiceImpl(config);
}
