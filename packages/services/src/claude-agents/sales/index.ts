/**
 * 銷售代理人模組
 *
 * 使用 Claude Agent SDK 實現的銷售輔助代理人
 */

// 增強版銷售教練 (Phase 4)
export {
  type AskCoachResult,
  analyzeWithCoach,
  askCoach,
  type CoachingAction,
  type CoachingResult,
  type FollowUpSchedule,
  type FollowUpTiming,
  formatCoachingAsMarkdown,
  getTalkTracks,
  scheduleFollowUp,
  type TalkTrack,
  type TalkTrackCategory,
} from "./coach-enhanced.js";

// 銷售記憶管理 (Phase 6)
export {
  type CustomerMemory,
  type CustomerProfile,
  extractMemoriesFromConversation,
  formatCustomerProfileAsMarkdown,
  formatInsightsAsMarkdown,
  generatePersonalizedInsights,
  getCustomerHistory,
  type MemoryInput,
  type MemorySearchOptions,
  type MemoryType,
  type PersonalizedInsight,
  saveCustomerMemory,
} from "./memory-manager.js";
