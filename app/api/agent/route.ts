import { NextResponse } from "next/server";
import { GoogleGenAI, Type } from "@google/genai";
import { classify, intentLabels, retrieveExamples } from "../../../lib/support";
import type { AgentResult, Intent } from "../../../lib/types";

export const runtime = "nodejs";

const intents = Object.keys(intentLabels) as Intent[];

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: {
      type: Type.STRING,
      enum: intents,
    },
    confidence: {
      type: Type.NUMBER,
    },
    decision: {
      type: Type.STRING,
      enum: ["AUTO-HANDLE", "ESCALATE"],
    },
    reason: {
      type: Type.STRING,
    },
    reply: {
      type: Type.STRING,
    },
    evidenceIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: ["intent", "confidence", "decision", "reason", "reply", "evidenceIds"],
};

const SYSTEM_INSTRUCTION = `You are Hiver Support Copilot, an AI customer-support agent for Apple Support.

For each incoming customer message:
- classify the intent using only the provided intent list;
- give an honest confidence score from 0 to 1;
- decide AUTO-HANDLE or ESCALATE;
- explain the decision briefly;
- write a fresh customer-facing response grounded in the supplied historical cases;
- identify which historical case IDs influenced the answer.

Grounding rules:
- Historical cases are evidence, not templates to copy.
- Never invent policies, refunds, replacements, warranty outcomes, account actions, or technical facts.
- Never request passwords, passcodes, verification codes, full card numbers, or secrets.
- If evidence is weak, the message is ambiguous, or confidence is low, prefer ESCALATE.
- Escalate account access, payments/billing, suspected fraud, safety concerns, physical damage/repair, and other high-risk cases.
- AUTO-HANDLE only routine, low-risk requests with useful supporting evidence.
- Write like a professional human support representative: empathetic, concise, specific, and actionable.
- Do not mention that you are an AI.
- Do not fabricate customer details.

Return only the requested JSON object.`;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const offline = classify(message);
      return NextResponse.json({
        result: offline,
        provider: "offline",
        model: "keyword-retrieval-fallback",
        notice: "GEMINI_API_KEY not set — using deterministic classifier. Add the key to .env.local for live generation.",
      });
    }

    const model = process.env.GEMINI_MODEL || "gemini-3.6-flash";
    const ai = new GoogleGenAI({ apiKey });
    const evidence = retrieveExamples(message, 5);

    const evidenceBlock = evidence.length
      ? evidence
          .map(
            (example, index) =>
              `EXAMPLE ${index + 1}\nID: ${example.tweet_id}\nCUSTOMER: ${example.text}\nHISTORICAL REPLY: ${example.response ?? "No reply captured"}`
          )
          .join("\n\n")
      : "No historical evidence was retrieved. Treat confidence as low and prefer escalation.";

    const prompt = `INCOMING CUSTOMER MESSAGE:\n${message}\n\nAVAILABLE INTENTS:\n${intents
      .map((intent) => `${intent}: ${intentLabels[intent]}`)
      .join("\n")}\n\nHISTORICAL EVIDENCE:\n${evidenceBlock}\n\nAnalyze the customer message and return the structured support-agent decision. Generate a NEW customer-facing response; do not simply select or copy a historical reply.`;

    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.25,
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const raw = response.text?.trim();
    if (!raw) {
      return NextResponse.json({ error: "Gemini returned an empty response." }, { status: 502 });
    }

    const parsed = JSON.parse(raw) as {
      intent: Intent;
      confidence: number;
      decision: AgentResult["decision"];
      reason: string;
      reply: string;
      evidenceIds: string[];
    };

    if (!intents.includes(parsed.intent)) {
      return NextResponse.json({ error: "Gemini returned an invalid intent." }, { status: 502 });
    }

    const confidence = Math.max(0, Math.min(1, Number(parsed.confidence)));
    const selectedEvidence = evidence.filter((example) => parsed.evidenceIds?.includes(example.tweet_id));

    const highRisk =
      parsed.intent === "account_access" ||
      parsed.intent === "payment_or_billing" ||
      parsed.intent === "hardware_repair" ||
      confidence < 0.67 ||
      /(password|passcode|verification code|full card number|fraud|stolen|fire|smoke|injur|danger)/i.test(message);

    const decision: AgentResult["decision"] = highRisk ? "ESCALATE" : parsed.decision;

    const result: AgentResult = {
      intent: parsed.intent,
      confidence,
      decision,
      reason:
        decision === parsed.decision
          ? parsed.reason
          : "This request is higher risk or too uncertain for automatic handling, so it should be reviewed by a human.",
      reply: parsed.reply,
      similar: selectedEvidence.length > 0 ? selectedEvidence : evidence,
    };

    return NextResponse.json({ result, provider: "Gemini", model });
  } catch (error) {
    console.error("Gemini support agent error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate a Gemini support decision." },
      { status: 500 }
    );
  }
}
