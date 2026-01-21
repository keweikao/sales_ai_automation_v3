// Import pre-compiled prompts (generated at build time)
// Run `bun run build:prompts` to regenerate from markdown files
import {
  agent1ContextPrompt,
  agent2BuyerPrompt,
  agent3SellerPrompt,
  agent4SummaryPrompt,
  agent5CrmPrompt,
  agent6CoachPrompt,
  globalContextPrompt,
  MEDDIC_PROMPTS,
  type ProductLine,
} from "./prompts.generated";

export type { ProductLine };

/**
 * iCHEF Business Framework - Three-layer commitment events
 * V2 Source: global-context.md
 * @deprecated Use GLOBAL_CONTEXT_FOR_PRODUCT_LINE for product-line specific context
 */
export const GLOBAL_CONTEXT = (): string => globalContextPrompt;

/**
 * Get Global Context based on product line
 * - ichef: Uses iCHEF Restaurant POS context
 * - beauty: Uses Qlieer 美業預約管理 context
 */
export const GLOBAL_CONTEXT_FOR_PRODUCT_LINE = (
  productLine: ProductLine = "ichef"
): string => {
  if (productLine === "beauty" && MEDDIC_PROMPTS.beauty.globalContext) {
    return MEDDIC_PROMPTS.beauty.globalContext;
  }
  return globalContextPrompt; // Default to iCHEF
};

/**
 * Meeting Background Analysis
 * V2 Source: agent1-context.md
 */
export const AGENT1_PROMPT = (): string => agent1ContextPrompt;

/**
 * MEDDIC Core Analysis (Buyer Agent)
 * V2 Source: agent2-buyer.md
 * ⭐ Most important prompt - MEDDIC six dimensions analysis
 */
export const AGENT2_PROMPT = (): string => agent2BuyerPrompt;

/**
 * Sales Strategy Assessment (Seller Agent)
 * V2 Source: agent3-seller.md
 */
export const AGENT3_PROMPT = (): string => agent3SellerPrompt;

/**
 * Customer-Oriented Summary
 * V2 Source: agent4-summary.md
 */
export const AGENT4_PROMPT = (): string => agent4SummaryPrompt;

/**
 * CRM Field Extraction
 * V2 Source: agent6.md (renamed to agent5 in V3)
 */
export const AGENT5_PROMPT = (): string => agent5CrmPrompt;

/**
 * Real-time Coaching System
 * V2 Source: agent_coach.md (renamed to agent6 in V3)
 */
export const AGENT6_PROMPT = (): string => agent6CoachPrompt;

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
