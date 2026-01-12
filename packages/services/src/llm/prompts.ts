import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROMPTS_DIR = join(__dirname, "../../prompts/meddic");

/**
 * Load a prompt file from the meddic prompts directory
 * @param agentName The name of the agent prompt file (without .md extension)
 * @returns The prompt content as a string
 */
export function loadPrompt(agentName: string): string {
  const filePath = join(PROMPTS_DIR, `${agentName}.md`);

  try {
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error(`Failed to load prompt: ${agentName}`, error);
    throw new Error(
      `Prompt file not found: ${agentName}.md. ` +
        "Please ensure all 7 MEDDIC prompts have been migrated from V2. " +
        "See packages/services/prompts/meddic/README.md for instructions."
    );
  }
}

/**
 * iCHEF Business Framework - Three-layer commitment events
 * V2 Source: global-context.md
 */
export const GLOBAL_CONTEXT = (): string => loadPrompt("global-context");

/**
 * Meeting Background Analysis
 * V2 Source: agent1-context.md
 */
export const AGENT1_PROMPT = (): string => loadPrompt("agent1-context");

/**
 * MEDDIC Core Analysis (Buyer Agent)
 * V2 Source: agent2-buyer.md
 * ⭐ Most important prompt - MEDDIC six dimensions analysis
 */
export const AGENT2_PROMPT = (): string => loadPrompt("agent2-buyer");

/**
 * Sales Strategy Assessment (Seller Agent)
 * V2 Source: agent3-seller.md
 */
export const AGENT3_PROMPT = (): string => loadPrompt("agent3-seller");

/**
 * Customer-Oriented Summary
 * V2 Source: agent4-summary.md
 */
export const AGENT4_PROMPT = (): string => loadPrompt("agent4-summary");

/**
 * CRM Field Extraction
 * V2 Source: agent6.md (renamed to agent5 in V3)
 */
export const AGENT5_PROMPT = (): string => loadPrompt("agent5-crm-extractor");

/**
 * Real-time Coaching System
 * V2 Source: agent_coach.md (renamed to agent6 in V3)
 */
export const AGENT6_PROMPT = (): string => loadPrompt("agent6-coach");

/**
 * Get all prompts as an object
 * Useful for validation and debugging
 */
export function getAllPrompts() {
  return {
    globalContext: GLOBAL_CONTEXT(),
    agent1: AGENT1_PROMPT(),
    agent2: AGENT2_PROMPT(),
    agent3: AGENT3_PROMPT(),
    agent4: AGENT4_PROMPT(),
    agent5: AGENT5_PROMPT(),
    agent6: AGENT6_PROMPT(),
  };
}

/**
 * Validate that all prompts can be loaded
 * @returns true if all prompts are available
 */
export function validatePrompts(): boolean {
  try {
    getAllPrompts();
    console.log("✅ All 7 MEDDIC prompts loaded successfully");
    return true;
  } catch (error) {
    console.error("❌ Prompt validation failed:", error);
    return false;
  }
}
