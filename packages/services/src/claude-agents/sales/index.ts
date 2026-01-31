/**
 * 銷售代理人模組
 *
 * 使用 Claude Agent SDK 實現的銷售輔助代理人
 */

// 增強版銷售教練
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
