export type Intent =
  | "battery_performance"
  | "ios_update_issue"
  | "app_or_device_issue"
  | "account_access"
  | "payment_or_billing"
  | "hardware_repair"
  | "information_request"
  | "other";

export type Decision = "AUTO-HANDLE" | "ESCALATE";

export interface SupportExample {
  tweet_id: string;
  author_id: string;
  inbound: boolean;
  created_at: string;
  text: string;
  response?: string;
}

export interface AgentResult {
  intent: Intent;
  confidence: number;
  decision: Decision;
  reason: string;
  reply: string;
  similar: SupportExample[];
}
