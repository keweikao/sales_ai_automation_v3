# MEDDIC Agent Prompts - V2 Migration

✅ **MIGRATION COMPLETE** - All 7 prompts have been migrated from V2.

## Prompt Files

| File | Description | V2 Source |
|------|-------------|-----------|
| `global-context.md` | iCHEF business framework (三層承諾事件) | global-context.md |
| `agent1-context.md` | Meeting background analysis | agent1-context.md |
| `agent2-buyer.md` | Customer insight analysis | agent2-buyer.md |
| `agent3-seller.md` | Sales strategy assessment | agent3-seller.md |
| `agent4-summary.md` | SMS + Meeting summary | agent4-summary.md |
| `agent5-crm-extractor.md` | CRM/Salesforce field extraction | agent6-crm-extractor.md |
| `agent6-coach.md` | Real-time coaching system | coach_agent.py (converted) |

## Usage

```typescript
import {
  GLOBAL_CONTEXT,
  AGENT1_PROMPT,
  AGENT2_PROMPT,
  AGENT3_PROMPT,
  AGENT4_PROMPT,
  AGENT5_PROMPT,
  AGENT6_PROMPT,
  validatePrompts,
} from '@Sales_ai_automation_v3/services';

// Validate all prompts load correctly
const isValid = validatePrompts();

// Use prompts
const systemPrompt = GLOBAL_CONTEXT();
const agent1Prompt = AGENT1_PROMPT();
```

## Validation Status

- ✅ All 7 files exist
- ✅ Prompts optimized for iCHEF business model
- ✅ Tuned for Gemini 2.0 Flash
- ✅ Chinese language (繁體中文) output
- ✅ Production-validated (~300 cases/month in V2)

## Notes

- `agent6-coach.md` was created based on V2's Python-based coach agent logic
- All prompts output structured JSON wrapped in `<JSON>...</JSON>` tags
- All prompts require 繁體中文 (Taiwan Traditional Chinese) output
