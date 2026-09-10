import examplesData from "../data/examples.json";
import { AgentResult, Intent, SupportExample } from "./types";

export const intentLabels: Record<Intent, string> = {
  battery_performance: "Battery & performance",
  ios_update_issue: "iOS update issue",
  app_or_device_issue: "App / device issue",
  account_access: "Account or access",
  payment_or_billing: "Payment / billing",
  hardware_repair: "Hardware / repair",
  information_request: "Information request",
  other: "Other",
};

const examples: SupportExample[] = examplesData as SupportExample[];

function tokens(s: string) {
  return new Set(
    s
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, " ")
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((x) => x.length > 2)
  );
}

function similarity(a: string, b: string) {
  const A = tokens(a);
  const B = tokens(b);
  let inter = 0;
  A.forEach((x) => {
    if (B.has(x)) inter++;
  });
  return inter / Math.max(1, Math.sqrt(A.size * B.size));
}

export function retrieveExamples(message: string, limit = 3) {
  return examples
    .map((e) => ({ e, score: similarity(message, e.text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) => e);
}

const KEYWORD_RULES: Array<{ intent: Intent; words: string[] }> = [
  {
    intent: "battery_performance",
    words: ["battery", "drain", "charging", "charge", "slow", "performance", "overheat", "hot"],
  },
  {
    intent: "ios_update_issue",
    words: ["update", "ios", "upgrade", "after update"],
  },
  {
    intent: "account_access",
    words: ["password", "login", "sign in", "locked", "account", "apple id", "verification"],
  },
  {
    intent: "payment_or_billing",
    words: ["refund", "charged", "billing", "payment", "subscription", "invoice", "purchase"],
  },
  {
    intent: "hardware_repair",
    words: ["broken", "screen", "cracked", "repair", "replacement", "damaged", "camera"],
  },
  {
    intent: "app_or_device_issue",
    words: ["app", "freeze", "crash", "wifi", "bluetooth", "speaker", "music", "not working"],
  },
  {
    intent: "information_request",
    words: ["how", "where", "which", "can i", "what", "support"],
  },
];

export function classifyMessage(message: string): Pick<AgentResult, "intent" | "confidence" | "decision" | "reason"> {
  const text = message.toLowerCase();
  const scores = KEYWORD_RULES.map((r) => ({
    intent: r.intent,
    score: r.words.reduce((n, w) => n + (text.includes(w) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);

  const top = scores[0];
  const topScore = top.score;
  const intent: Intent = topScore ? top.intent : "other";
  const sensitive = /(password|passcode|verification code|account number|card number|payment|refund|charged)/i.test(
    message
  );
  const severe = /(fire|smoke|explod|injur|danger|stolen|fraud|brick|smoking)/i.test(message);
  const confidence = Math.min(0.97, Math.max(0.42, 0.48 + topScore * 0.09));
  const highRiskIntent =
    intent === "account_access" || intent === "payment_or_billing" || intent === "hardware_repair";
  const decision: AgentResult["decision"] =
    sensitive || severe || confidence < 0.67 || highRiskIntent ? "ESCALATE" : "AUTO-HANDLE";

  return {
    intent,
    confidence,
    decision,
    reason:
      decision === "ESCALATE"
        ? "This request needs human review rather than an automatic response."
        : "The request is supported by matching historical support patterns.",
  };
}

export function draftFallbackReply(message: string, intent: Intent, similar: SupportExample[]) {
  const pattern = similar.find((e) => e.response)?.response;
  const askDevice =
    "Please share your iPhone model and iOS version (Settings > General > About) so we can narrow this down.";
  const askDm = "Send us a DM with those details and we'll take a closer look.";

  if (pattern) {
    return `${pattern.replace(/@\d+/g, "").trim()}\n\n${askDevice}`;
  }

  const templates: Record<Intent, string> = {
    battery_performance: `I can help with the battery concern. ${askDevice} ${askDm}`,
    ios_update_issue: `Sorry the update has been frustrating. ${askDevice} When did the issue start? ${askDm}`,
    app_or_device_issue: `Let's troubleshoot the app/device issue. Which app or feature is affected, and ${askDevice.toLowerCase()} ${askDm}`,
    account_access: `Account access issues need secure handling. Please DM us — do not share passwords or verification codes here.`,
    payment_or_billing: `Billing questions should be reviewed by a specialist. Please DM us your purchase details — never share full card numbers publicly.`,
    hardware_repair: `For hardware damage or repair, we'll connect you with the right support path. ${askDm}`,
    information_request: `Happy to help. Could you clarify what you're trying to do? ${askDm}`,
    other: `Thanks for reaching out. Could you share a few more details about what you need help with? ${askDm}`,
  };

  return templates[intent];
}

/** Offline/demo classifier used by evaluation baselines and API fallback. */
export function classify(message: string): AgentResult {
  const nearest = retrieveExamples(message, 3);
  const { intent, confidence, decision, reason } = classifyMessage(message);
  return {
    intent,
    confidence,
    decision,
    reason,
    reply: draftFallbackReply(message, intent, nearest),
    similar: nearest,
  };
}

export function getExamples() {
  return examples;
}
