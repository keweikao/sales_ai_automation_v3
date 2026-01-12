// scripts/migration/types.ts

import type { Timestamp } from "firebase-admin/firestore";

// V2 Firestore 類型
export interface FirestoreLead {
  id?: string;
  email?: string;
  status?: string;
  score?: number;
  created_at?: Timestamp;
  updated_at?: Timestamp;
}

export interface FirestoreConversation {
  id?: string;
  lead_id?: string;
  sales_rep?: string;
  status?: string;
  type?: string;
  occurred_at?: Timestamp;
  created_at?: Timestamp;
  updated_at?: Timestamp;
  audio_gcs_uri?: string;
  transcript?: {
    segments?: Array<{
      speaker: string;
      text: string;
      start: number;
      end: number;
    }>;
    full_text?: string;
    language?: string;
    duration?: number;
  };
  analysis?: {
    meddic_score?: number;
    progress_score?: number;
    executive_summary?: string;
    coaching_notes?: string;
    urgency_level?: string;
    store_name?: string;
    qualification_status?: string;
    buyer_signals?: Record<string, unknown>;
    agent_data?: {
      context?: Record<string, unknown>;
      buyer?: Record<string, unknown>;
      seller?: Record<string, unknown>;
      summary?: Record<string, unknown>;
      crm?: Record<string, unknown>;
      coach?: Record<string, unknown>;
    };
  };
}

// 遷移統計
export interface MigrationStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ id: string; error: string }>;
}

// 遷移結果
export interface MigrationResult {
  leads: MigrationStats;
  conversations: MigrationStats;
  meddicAnalyses: MigrationStats;
  audioFiles: MigrationStats;
  duration: number;
  startedAt: Date;
  completedAt: Date;
}

// 遷移進度（用於斷點續傳）
export interface MigrationProgress {
  lastProcessedLeadId?: string;
  lastProcessedConversationId?: string;
  lastProcessedMeddicId?: string;
  completedPhases: ("leads" | "conversations" | "meddic" | "audio")[];
  updatedAt: Date;
}

// 建立空的統計物件
export function createEmptyStats(): MigrationStats {
  return {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };
}
