"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import type { AgentResult } from "../lib/types";
import { intentLabels } from "../lib/support";

const suggestions = [
  "My battery drops 20% in an hour after the latest iOS update.",
  "My apps keep freezing after I installed the latest iOS update.",
  "I cannot access my Apple account and I am locked out.",
  "I was charged twice for the same purchase.",
];

export default function SupportConsole() {
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    const value = message.trim();
    if (!value || loading) return;

    setLoading(true);
    setError("");
    setResult(null);
    setProvider("");

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: value }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "The agent could not complete the request.");
      }

      if (!data?.result) {
        throw new Error("No agent result returned.");
      }

      setResult(data.result);
      setProvider(data.provider === "offline" ? "Offline fallback" : data.model || "Gemini");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to reach the agent.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessage("");
    setResult(null);
    setError("");
    setProvider("");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Hiver take-home · Apple Support</p>
            <h1 className="text-lg font-semibold">Support Copilot</h1>
          </div>
          <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            {provider || "Ready"}
          </p>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold">Customer message</h2>
          <p className="mt-1 text-sm text-slate-500">Paste a tweet, or use one of the examples.</p>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") run();
            }}
            placeholder="Paste an incoming support message..."
            className="mt-4 min-h-[160px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm leading-6 outline-none focus:border-slate-400 focus:bg-white"
          />

          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setMessage(item)}
                className="rounded-full border border-slate-200 px-3 py-1.5 text-left text-xs text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              >
                {item.length > 52 ? `${item.slice(0, 52)}…` : item}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={run}
              disabled={!message.trim() || loading}
              className="flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? "Working…" : "Run agent"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
              title="Clear"
            >
              <RotateCcw size={16} />
            </button>
          </div>

          {error && (
            <div className="mt-4 flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          {!result && !loading && (
            <div className="flex min-h-[280px] items-center justify-center text-center text-sm text-slate-500">
              Results appear here: intent, routing, draft reply, and similar past cases.
            </div>
          )}

          {loading && (
            <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 text-sm text-slate-500">
              <Loader2 size={20} className="animate-spin" />
              Retrieving similar cases and drafting a reply…
            </div>
          )}

          {result && !loading && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">Intent</p>
                  <h2 className="text-xl font-semibold">{intentLabels[result.intent]}</h2>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    result.decision === "AUTO-HANDLE"
                      ? "bg-emerald-50 text-emerald-800"
                      : "bg-rose-50 text-rose-800"
                  }`}
                >
                  {result.decision}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Confidence</p>
                  <p className="mt-1 font-semibold">{Math.round(result.confidence * 100)}%</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Similar cases</p>
                  <p className="mt-1 font-semibold">{result.similar.length}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500">Why this routing</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{result.reason}</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-medium text-slate-500">Draft reply</p>
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-800">{result.reply}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-slate-500">Historical evidence</p>
                <div className="mt-2 space-y-2">
                  {result.similar.map((example, index) => (
                    <div key={example.tweet_id} className="rounded-lg bg-slate-50 p-3 text-sm">
                      <p className="text-xs text-slate-400">Case {index + 1}</p>
                      <p className="mt-1 leading-6 text-slate-700">{example.text}</p>
                      {example.response && (
                        <p className="mt-2 leading-6 text-slate-500">
                          <span className="font-medium text-slate-700">Past reply: </span>
                          {example.response}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
