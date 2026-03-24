/**
 * AI Assistant — Type definitions (Production-hardened)
 *
 * All AI interactions produce structured, schema-validated output.
 * NO raw HTML. NO auto-apply. User always approves.
 */

/* ================================================================== */
/*  Core enums                                                         */
/* ================================================================== */

export type AiAction = "generate" | "improve" | "expand" | "generate-page" | "generate-job" | "generate-site";

export type AiTone = "professional" | "friendly" | "bold" | "minimal" | "hiring-focused";

export type AiIndustry =
  | "technology"
  | "fintech"
  | "healthcare"
  | "education"
  | "ecommerce"
  | "saas"
  | "consulting"
  | "manufacturing"
  | "media"
  | "nonprofit"
  | "other";

export type AiCompanyType = "startup" | "scaleup" | "enterprise" | "agency" | "nonprofit";

export type AiAudience = "engineers" | "designers" | "sales" | "marketing" | "operations" | "executives" | "general";

/* ================================================================== */
/*  Subscription / Access control                                      */
/* ================================================================== */

export type SubscriptionPlan = "free" | "pro" | "enterprise";

export interface SubscriptionStatus {
  plan: SubscriptionPlan;
  aiEnabled: boolean;
  aiCreditsRemaining: number;
  aiCreditsTotal: number;
  /** Stripe subscription status: none | active | past_due | canceled | trialing */
  subscriptionStatus: string;
  /** Whether this user has a linked Stripe customer (has ever subscribed) */
  hasStripeCustomer: boolean;
  /** ISO date — start of current billing cycle */
  billingCycleStart: string | null;
  /** ISO date — when AI credits reset (next billing date) */
  aiCreditsResetAt: string | null;
  /** Weekly job AI credits remaining (25/week for Pro/Enterprise) */
  jobAiCreditsRemaining: number;
  /** Weekly job AI credits total per week */
  jobAiCreditsTotal: number;
  /** ISO date — when weekly job credits reset */
  jobAiCreditsResetAt: string | null;
  /** @deprecated Use aiCreditsResetAt instead */
  expiresAt?: string;
}

export const PLAN_FEATURES: Record<SubscriptionPlan, { label: string; aiEnabled: boolean; aiCreditsPerMonth: number }> = {
  free: { label: "Free", aiEnabled: false, aiCreditsPerMonth: 0 },
  pro: { label: "Pro", aiEnabled: true, aiCreditsPerMonth: 1000 },
  enterprise: { label: "Enterprise", aiEnabled: true, aiCreditsPerMonth: 5000 },
};

/* ================================================================== */
/*  Request / Context                                                  */
/* ================================================================== */

export interface AiRequest {
  /** The action to perform */
  action: AiAction;
  /** Block type from blockSchemas — required for single-block actions */
  blockType: string;
  /** Current props (for improve/expand) */
  currentProps?: Record<string, any>;
  /** User's custom instruction (max 2000 chars, enforced server-side) */
  prompt?: string;
  /** Desired tone */
  tone?: AiTone;
  /** Context about the company/tenant */
  context?: AiContext;
}

export interface AiContext {
  companyName?: string;
  industry?: AiIndustry;
  companyType?: AiCompanyType;
  audience?: AiAudience;
  pageType?: string;
  existingBlockTypes?: string[];
}

/* ================================================================== */
/*  Responses                                                          */
/* ================================================================== */

export interface AiResponse {
  /** Whether the generation succeeded */
  success: boolean;
  /** Generated props that match the block schema (single-block) */
  props?: Record<string, any>;
  /** Block type */
  blockType?: string;
  /** Human-readable explanation of what was generated */
  explanation?: string;
  /** Error message if failed */
  error?: string;
  /** For generate-page: array of blocks */
  blocks?: AiPageBlock[];
}

export interface AiPageBlock {
  type: string;
  props: Record<string, any>;
}

/* ================================================================== */
/*  Preview state (UI)                                                 */
/* ================================================================== */

export interface AiPreviewState {
  /** Current action being previewed */
  action: AiAction;
  /** Block type */
  blockType: string;
  /** Original props before AI */
  originalProps: Record<string, any>;
  /** AI-generated props */
  generatedProps: Record<string, any>;
  /** Explanation from AI */
  explanation: string;
  /** Whether the user is editing the generated props */
  isEditing: boolean;
}

export interface AiPagePreviewState {
  /** Prompt the user gave */
  prompt: string;
  /** Generated blocks */
  blocks: AiPageBlock[];
  /** Explanation */
  explanation: string;
}

/* ================================================================== */
/*  Job generation types                                               */
/* ================================================================== */

export interface AiJobFormData {
  title: string;
  department: string;
  location: string;
  description: string;
  employmentType: string;
  experienceLevel: string;
  salaryMin: string;
  salaryMax: string;
  isRemote: boolean;
  isPublished: boolean;
  requirements: string;
  benefits: string;
  tags: string;
}

export interface AiJobRequest {
  action: "generate-job";
  /** Partial form data the user has already filled in (for context) */
  currentData?: Partial<AiJobFormData>;
  /** User's custom instruction */
  prompt?: string;
  /** Desired tone */
  tone?: AiTone;
  /** Context about the company */
  context?: AiContext;
}

export interface AiJobResponse {
  success: boolean;
  job?: AiJobFormData;
  explanation?: string;
  error?: string;
}

/* ================================================================== */
/*  Config constants (shared between client + server)                  */
/* ================================================================== */

export const AI_LIMITS = {
  /** Max chars for user prompt */
  MAX_PROMPT_LENGTH: 2000,
  /** Max total chars sent to AI provider (prompt + schema) */
  MAX_TOTAL_PROMPT_CHARS: 5000,
  /** API timeout in ms */
  TIMEOUT_MS: 15_000,
  /** Max tokens for AI response */
  MAX_TOKENS: 800,
  /** Rate limits per action per minute */
  RATE_LIMITS: {
    generate: 15,
    improve: 30,
    expand: 30,
    "generate-page": 8,
    "generate-job": 15,
    "generate-site": 3,
  },
  /** Response cache TTL in ms */
  CACHE_TTL: 5 * 60 * 1000,
  /** Max blocks in a generated page */
  MAX_PAGE_BLOCKS: 14,
  /** Debounce delay for AI calls (ms) */
  DEBOUNCE_MS: 300,
} as const;
