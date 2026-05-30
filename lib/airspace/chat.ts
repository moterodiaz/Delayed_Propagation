// lib/airspace/chat.ts
// Grounded chatbot (R8). Real LLM via Anthropic REST (no SDK dep); cached fallback on any failure.
// Ported from backend/chat.py.
import type { StateModel } from "./types";
import { loadChatFallback } from "./loader";

const MODEL = "claude-sonnet-4-6";
const GENERIC =
  "I can summarize active disruptions, break down cost per event, recommend a priced action, " +
  "or draft crew/ops comms. Try one of the demo prompts.";

const usd = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");

export function fallbackAnswer(message: string): string {
  const fb = loadChatFallback();
  const key = message.trim().toLowerCase().replace(/\?+$/, "");
  for (const [k, v] of Object.entries(fb)) {
    if (k.replace(/\?+$/, "") === key) return v;
  }
  for (const [k, v] of Object.entries(fb)) {
    const toks = k.replace(/\?+$/, "").split(/\s+/).filter((t) => t.length > 4);
    if (toks.some((t) => key.includes(t))) return v;
  }
  return GENERIC;
}

export function buildFacts(state: StateModel): string {
  const lines: string[] = [
    "COMPUTED FACTS (use ONLY these numbers, do not invent any):",
  ];
  for (const e of state.events) {
    lines.push(
      `- ${e.name}: ${e.affectedFlightIds.length} affected flights, total cost ${usd(
        e.cost.totalUsd,
      )} (fuel ${usd(e.cost.fuelUsd)}, delay ${usd(e.cost.delayUsd)}, crew ${usd(
        e.cost.crewUsd,
      )}).`,
    );
    lines.push(`  Affected: ${e.affectedFlightIds.join(", ")}.`);
    for (const o of e.options) {
      const mark = o.cheapest ? " (CHEAPEST)" : "";
      lines.push(`  Option ${o.kind}: ${usd(o.costUsd)}${mark} -- ${o.rationale}`);
    }
  }
  const n = state.network;
  lines.push(
    `- Network: acting alone ${usd(n.selfishUsd)} vs coordinated ${usd(
      n.coordinatedUsd,
    )} (gap ${usd(n.gapUsd)}).`,
  );
  lines.push(
    "- Weather at KFLL/KMIA/MKJP is clear VFR -- airspace closure, not weather.",
  );
  return lines.join("\n");
}

export async function ask(
  message: string,
  state: StateModel,
): Promise<{ reply: string; source: "live" | "fallback" }> {
  const facts = buildFacts(state);
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { reply: fallbackAnswer(message), source: "fallback" };

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        system:
          "You are an airline operations assistant. Answer using ONLY the computed facts provided. " +
          "Never invent numbers. Be concise and operational.\n\n" +
          facts,
        messages: [{ role: "user", content: message }],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as {
      content?: Array<{ text?: string }>;
    };
    const reply = data.content?.[0]?.text;
    if (!reply) throw new Error("empty reply");
    return { reply, source: "live" };
  } catch {
    return { reply: fallbackAnswer(message), source: "fallback" };
  }
}
