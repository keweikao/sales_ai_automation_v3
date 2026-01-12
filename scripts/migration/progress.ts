// scripts/migration/progress.ts

import type { MigrationProgress } from "./types";

const PROGRESS_FILE = "migration-progress.json";

/**
 * 讀取遷移進度
 */
export async function loadProgress(): Promise<MigrationProgress | null> {
  try {
    const file = Bun.file(PROGRESS_FILE);
    if (await file.exists()) {
      const content = await file.text();
      if (content.trim()) {
        return JSON.parse(content) as MigrationProgress;
      }
    }
  } catch (error) {
    console.warn("Failed to load migration progress:", error);
  }
  return null;
}

/**
 * 儲存遷移進度
 */
export async function saveProgress(progress: MigrationProgress): Promise<void> {
  progress.updatedAt = new Date();
  await Bun.write(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * 清除遷移進度
 */
export async function clearProgress(): Promise<void> {
  try {
    const file = Bun.file(PROGRESS_FILE);
    if (await file.exists()) {
      await Bun.write(PROGRESS_FILE, "");
    }
  } catch (error) {
    console.warn("Failed to clear migration progress:", error);
  }
}

/**
 * 建立新的遷移進度
 */
export function createProgress(): MigrationProgress {
  return {
    completedPhases: [],
    updatedAt: new Date(),
  };
}

/**
 * 標記階段完成
 */
export async function markPhaseComplete(
  phase: MigrationProgress["completedPhases"][number]
): Promise<void> {
  const progress = (await loadProgress()) || createProgress();
  if (!progress.completedPhases.includes(phase)) {
    progress.completedPhases.push(phase);
  }
  await saveProgress(progress);
}

/**
 * 檢查階段是否已完成
 */
export async function isPhaseComplete(
  phase: MigrationProgress["completedPhases"][number]
): Promise<boolean> {
  const progress = await loadProgress();
  return progress?.completedPhases.includes(phase);
}
