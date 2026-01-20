/**
 * Build script to convert markdown prompt files into TypeScript constants
 * This allows us to bundle prompts at build time for Cloudflare Workers
 *
 * V2: Supports nested directory structure (shared/ichef/beauty)
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROMPTS_DIR = join(__dirname, "../prompts/meddic");
const OUTPUT_FILE = join(__dirname, "../src/llm/prompts.generated.ts");

interface PromptEntry {
  name: string;
  content: string;
}

interface ProductLinePrompts {
  shared: PromptEntry[];
  ichef: PromptEntry[];
  beauty: PromptEntry[];
}

/**
 * Escape special characters in template literals
 */
function escapeContent(content: string): string {
  return content
    .replace(/\\/g, "\\\\") // Escape backslashes first
    .replace(/`/g, "\\`") // Escape backticks
    .replace(/\$/g, "\\$"); // Escape dollar signs
}

/**
 * Convert kebab-case to camelCase
 */
function toCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

/**
 * Read all markdown files from a directory
 */
function readPromptsFromDir(dirPath: string): PromptEntry[] {
  const entries: PromptEntry[] = [];

  try {
    const files = readdirSync(dirPath);

    for (const file of files) {
      const filePath = join(dirPath, file);
      const stat = statSync(filePath);

      // Skip directories and non-markdown files
      if (stat.isDirectory() || !file.endsWith(".md")) {
        continue;
      }

      // Skip README files
      if (file.toLowerCase() === "readme.md") {
        continue;
      }

      const name = file.replace(".md", "");
      const content = readFileSync(filePath, "utf-8");
      const escapedContent = escapeContent(content);

      entries.push({ name, content: escapedContent });
    }
  } catch (error) {
    // Directory doesn't exist, return empty array
    console.warn(`Warning: Directory ${dirPath} not found, skipping.`);
    return [];
  }

  return entries;
}

/**
 * Read legacy prompts from the root meddic directory
 */
function readLegacyPrompts(): PromptEntry[] {
  const legacyPrompts = [
    "global-context",
    "agent1-context",
    "agent2-buyer",
    "agent3-seller",
    "agent4-summary",
    "agent5-crm-extractor",
    "agent6-coach",
  ];

  const entries: PromptEntry[] = [];

  for (const name of legacyPrompts) {
    const filePath = join(PROMPTS_DIR, `${name}.md`);
    try {
      const content = readFileSync(filePath, "utf-8");
      const escapedContent = escapeContent(content);
      entries.push({ name, content: escapedContent });
    } catch (error) {
      console.warn(`Warning: Legacy prompt ${name}.md not found, skipping.`);
    }
  }

  return entries;
}

/**
 * Build product line prompts from nested directory structure
 */
function buildPrompts(): ProductLinePrompts {
  const shared = readPromptsFromDir(join(PROMPTS_DIR, "shared"));
  const ichef = readPromptsFromDir(join(PROMPTS_DIR, "ichef"));
  const beauty = readPromptsFromDir(join(PROMPTS_DIR, "beauty"));

  console.log(`📁 Found ${shared.length} shared prompts`);
  console.log(`📁 Found ${ichef.length} iCHEF prompts`);
  console.log(`📁 Found ${beauty.length} beauty prompts`);

  return { shared, ichef, beauty };
}

/**
 * Generate TypeScript object from prompts
 */
function generatePromptsObject(prompts: PromptEntry[], indent = "    "): string {
  return prompts
    .map(
      (p) => `${indent}${toCamelCase(p.name)}: \`${p.content}\`,`
    )
    .join("\n");
}

/**
 * Generate legacy prompt exports
 */
function generateLegacyExports(prompts: PromptEntry[]): string {
  const varNameMap: Record<string, string> = {
    "global-context": "globalContextPrompt",
    "agent1-context": "agent1ContextPrompt",
    "agent2-buyer": "agent2BuyerPrompt",
    "agent3-seller": "agent3SellerPrompt",
    "agent4-summary": "agent4SummaryPrompt",
    "agent5-crm-extractor": "agent5CrmPrompt",
    "agent6-coach": "agent6CoachPrompt",
  };

  return prompts
    .map((p) => {
      const varName = varNameMap[p.name] || toCamelCase(p.name);
      return `export const ${varName} = \`${p.content}\`;`;
    })
    .join("\n\n");
}

/**
 * Generate the complete TypeScript file
 */
function generateTypeScriptFile(
  prompts: ProductLinePrompts,
  legacyPrompts: PromptEntry[]
): string {
  return `// Auto-generated file - DO NOT EDIT
// Generated from markdown files in packages/services/prompts/meddic/
// Run \`bun run build:prompts\` to regenerate

// ============================================================
// Legacy Prompts (Agent 1-6) - For backward compatibility
// ============================================================

${generateLegacyExports(legacyPrompts)}

// ============================================================
// MEDDIC Prompts (Product Line Specific)
// ============================================================

/**
 * MEDDIC 提示詞集合
 * 支援產品線特定提示詞 (shared/ichef/beauty)
 */
export const MEDDIC_PROMPTS = {
  shared: {
${generatePromptsObject(prompts.shared)}
  },
  ichef: {
${generatePromptsObject(prompts.ichef)}
  },
  beauty: {
${generatePromptsObject(prompts.beauty)}
  },
} as const;

export type ProductLine = "ichef" | "beauty";
`;
}

// Main execution
const legacyPrompts = readLegacyPrompts();
const productLinePrompts = buildPrompts();
const output = generateTypeScriptFile(productLinePrompts, legacyPrompts);
writeFileSync(OUTPUT_FILE, output, "utf-8");

console.log(`📁 Found ${legacyPrompts.length} legacy prompts`);
console.log("✅ Prompts compiled successfully!");
console.log(`📄 Generated: ${OUTPUT_FILE}`);
