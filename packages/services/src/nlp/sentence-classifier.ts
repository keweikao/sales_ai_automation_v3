/**
 * 句子分類器
 * 判斷句子應該直接匹配、送 AI 分析、或跳過
 */

import {
  IMPORTANCE_PATTERNS,
  OBJECTION_TAGS,
  SKIP_PATTERNS,
} from "./dictionaries/common";
import {
  ICHEF_COMPETITORS,
  ICHEF_FEATURE_TAGS,
  ICHEF_PAIN_TAGS,
} from "./dictionaries/ichef";

/**
 * 句子分類狀態
 */
export type SentenceStatus = "matched" | "uncertain" | "skip";

/**
 * 不確定原因類型
 */
export type UncertainReason =
  | "customer_need"
  | "external_platform"
  | "problem_context"
  | "quantified"
  | "strong_emotion"
  | "general_important";

/**
 * 標籤匹配結果
 */
export interface TagMatch {
  category: "feature" | "pain" | "objection" | "competitor";
  tag: string;
  quote: string;
  confidence: number;
}

/**
 * 分類結果
 */
export interface ClassifiedSentence {
  sentence: string;
  status: SentenceStatus;
  matchedTags?: TagMatch[];
  uncertainReason?: UncertainReason;
  skipReason?: string;
}

/**
 * 對句子進行規則匹配
 * @param sentence 句子
 * @param productLine 產品線
 */
export function matchRules(
  sentence: string,
  productLine: "ichef" | "beauty" = "ichef"
): TagMatch[] {
  const matches: TagMatch[] = [];

  // 目前只支援 iCHEF，美業可以之後擴充
  if (productLine !== "ichef") {
    return matches;
  }

  // 1. 功能標籤匹配
  for (const [tag, config] of Object.entries(ICHEF_FEATURE_TAGS)) {
    for (const keyword of config.keywords) {
      if (sentence.includes(keyword)) {
        matches.push({
          category: "feature",
          tag,
          quote: sentence,
          confidence: 0.8,
        });
        break; // 每個 tag 只匹配一次
      }
    }
  }

  // 2. 痛點標籤匹配
  for (const [tag, config] of Object.entries(ICHEF_PAIN_TAGS)) {
    for (const keyword of config.keywords) {
      if (sentence.includes(keyword)) {
        // 檢查嚴重度增強詞
        const hasSeverityBoost = config.severityBoost.some((boost) =>
          sentence.includes(boost)
        );
        matches.push({
          category: "pain",
          tag,
          quote: sentence,
          confidence: hasSeverityBoost ? 0.9 : 0.7,
        });
        break;
      }
    }
  }

  // 3. 異議標籤匹配
  for (const [tag, config] of Object.entries(OBJECTION_TAGS)) {
    for (const keyword of config.keywords) {
      if (sentence.includes(keyword)) {
        matches.push({
          category: "objection",
          tag,
          quote: sentence,
          confidence: 0.75,
        });
        break;
      }
    }
  }

  // 4. 競品匹配
  for (const [name, aliases] of Object.entries(ICHEF_COMPETITORS)) {
    for (const alias of aliases) {
      if (sentence.toLowerCase().includes(alias.toLowerCase())) {
        matches.push({
          category: "competitor",
          tag: name,
          quote: sentence,
          confidence: 0.85,
        });
        break;
      }
    }
  }

  return matches;
}

/**
 * 檢測不確定原因
 * @param sentence 句子
 */
function detectUncertainReason(sentence: string): UncertainReason | null {
  // 檢查客戶需求模式
  for (const pattern of IMPORTANCE_PATTERNS.customerNeed) {
    if (pattern.test(sentence)) {
      return "customer_need";
    }
  }

  // 檢查外部平台提及
  for (const pattern of IMPORTANCE_PATTERNS.externalPlatform) {
    if (pattern.test(sentence)) {
      return "external_platform";
    }
  }

  // 檢查問題情境
  for (const pattern of IMPORTANCE_PATTERNS.problemContext) {
    if (pattern.test(sentence)) {
      return "problem_context";
    }
  }

  // 檢查量化描述
  if (IMPORTANCE_PATTERNS.quantification.test(sentence)) {
    return "quantified";
  }

  // 檢查強烈情緒
  for (const pattern of IMPORTANCE_PATTERNS.strongEmotion) {
    if (pattern.test(sentence)) {
      return "strong_emotion";
    }
  }

  return null;
}

/**
 * 分類單個句子
 * @param sentence 句子
 * @param ruleMatches 規則匹配結果
 */
export function classifySentence(
  sentence: string,
  ruleMatches: TagMatch[]
): ClassifiedSentence {
  const trimmed = sentence.trim();

  // 1. 太短
  if (trimmed.length < SKIP_PATTERNS.minLength) {
    return { sentence, status: "skip", skipReason: "too_short" };
  }

  // 2. 太長
  if (trimmed.length > SKIP_PATTERNS.maxLength) {
    return { sentence, status: "skip", skipReason: "too_long" };
  }

  // 3. 純回應詞
  if (SKIP_PATTERNS.responseWords.includes(trimmed)) {
    return { sentence, status: "skip", skipReason: "response_word" };
  }

  // 4. 有規則匹配
  if (ruleMatches.length > 0) {
    return { sentence, status: "matched", matchedTags: ruleMatches };
  }

  // 5. 判斷是否「看起來重要」
  const uncertainReason = detectUncertainReason(trimmed);
  if (uncertainReason) {
    return { sentence, status: "uncertain", uncertainReason };
  }

  // 6. 不重要，跳過
  return { sentence, status: "skip", skipReason: "not_important" };
}

/**
 * 從逐字稿提取句子
 * @param transcript 逐字稿文本
 */
export function extractSentences(transcript: string): string[] {
  // 優先使用句號、問號、驚嘆號、換行分割
  const primarySeparators = /[。！？!?\n]+/;
  let sentences = transcript
    .split(primarySeparators)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // 計算平均句子長度，如果太長（>150字）表示分割不夠細
  const avgLength =
    sentences.length > 0
      ? transcript.length / sentences.length
      : transcript.length;
  const needsMoreSplit = avgLength > 150 && transcript.length > 200;

  // 如果分割後句子太少或平均太長，嘗試用逗號分割
  if (needsMoreSplit) {
    const commaSeparators = /[，,、；;]+/;
    const fragments = transcript
      .split(commaSeparators)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (fragments.length > sentences.length) {
      // 合併短片段成為較長的句子（目標：每句 30-100 字）
      sentences = [];
      let current = "";
      for (const fragment of fragments) {
        if (current.length === 0) {
          current = fragment;
        } else if (current.length + fragment.length < 80) {
          current += "，" + fragment;
        } else {
          sentences.push(current);
          current = fragment;
        }
      }
      if (current.length > 0) {
        sentences.push(current);
      }
    }
  }

  // 重新計算平均長度，如果還是太長（語音轉文字可能完全沒有標點），按固定長度分割
  const newAvgLength =
    sentences.length > 0
      ? transcript.length / sentences.length
      : transcript.length;
  if (newAvgLength > 150 && transcript.length > 200) {
    sentences = [];
    const targetLength = 60; // 每句約 60 字
    let start = 0;

    while (start < transcript.length) {
      let end = Math.min(start + targetLength, transcript.length);

      // 嘗試在自然斷點結束（常見的口語詞）
      if (end < transcript.length) {
        const searchRange = transcript.slice(
          start,
          Math.min(end + 20, transcript.length)
        );
        // 尋找口語中的自然斷點
        const breakPoints = [
          "对",
          "對",
          "好",
          "嗯",
          "哦",
          "啊",
          "呢",
          "吧",
          "啦",
          "喔",
          "OK",
          "ok",
          "那",
          "就是",
          "然后",
          "然後",
          "所以",
          "但是",
        ];

        let bestBreak = -1;
        for (const bp of breakPoints) {
          const idx = searchRange.lastIndexOf(bp);
          if (idx > targetLength - 20 && idx > bestBreak) {
            bestBreak = idx + bp.length;
          }
        }

        if (bestBreak > 0) {
          end = start + bestBreak;
        }
      }

      const sentence = transcript.slice(start, end).trim();
      if (sentence.length > 0) {
        sentences.push(sentence);
      }
      start = end;
    }
  }

  return sentences;
}

/**
 * 批次分類句子
 * @param sentences 句子列表
 * @param productLine 產品線
 */
export function classifySentences(
  sentences: string[],
  productLine: "ichef" | "beauty" = "ichef"
): ClassifiedSentence[] {
  return sentences.map((sentence) => {
    const ruleMatches = matchRules(sentence, productLine);
    return classifySentence(sentence, ruleMatches);
  });
}
