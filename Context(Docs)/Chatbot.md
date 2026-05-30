# Chatbot — Implementation Plan

**Panel:** Bottom-right of the 4-panel layout.
**Model:** `claude-sonnet-4-6` via Anthropic API (server-side only).
**Key:** `ANTHROPIC_API_KEY` in `.env.local` — never committed, never in browser.

---

## What it does

User types a question → Next.js API route builds a system prompt grounded in real computed numbers (JBU1575 cost, network gap, affected flights) → streams Claude response back. "Re-run simulation" = parametric recalculation (e.g. "what if TFR started at 20:00Z?") — backend shifts inputs, recomputes cost, feeds new numbers into the reply. No map re-render for Tier 1.

---

## 3 pieces to build

### 1. `app/api/chat/route.ts` (POST, server-side)

- Reads `data/casualties.json` + cost constants at request time
- Builds grounded system prompt:

```
You are the JetBlue ops center AI. Today's event: SpaceX Flight 12 TFR 21:30–23:43Z.

Computed facts (cite these, do not invent):
- JBU1575: 373 nm wasted, $2,350 fuel cost, 133 min delay, returned KFLL
- Network: 15 flights affected, $41,200 total cost
- Coordination gap: $10,200 saved if coordinated vs selfish-optimal
- JetBlue fleet hit: JBU1575, JBU238, JBU2694, JBU575

If asked to re-run with a different TFR start time: recalculate extra_nm × 1.8 gal/nm × $3.50.
Offer 3 priced action options (hold / divert / pre-empt) when relevant.
Draft crew/ops comms when asked. Keep answers concise. Always cite dollar figures.
```

- Calls `anthropic.messages.stream(...)` with model `claude-sonnet-4-6`
- Returns `ReadableStream` of streamed tokens
- **Cached fallback:** 5 pre-written answers keyed to demo prompts — if Anthropic throws, return matching cached string (demo never crashes)

### 2. `components/ChatPanel.tsx`

- Fixed-height panel with scroll, bottom-right of layout
- Message list: user messages right-aligned, assistant left-aligned
- Input bar + Send button
- Streams tokens as they arrive (no waiting for full response)
- Pre-loaded suggested question chips:
  - "What happened to JBU1575 and what did it cost?"
  - "What are the 3 action options for the next affected flight?"
  - "What if the TFR had started at 20:00Z?"
  - "Draft a crew message for JBU1575"

### 3. `app/page.tsx` — wire in

- Add `<ChatPanel />` to bottom-right grid slot
- Pass `casualties` data as prop for immediate context display

---

## Re-run simulation mechanic

Parametric heuristic — not a real solver:

User: *"What if the TFR started at 20:00Z instead of 21:30?"*
Backend: shifts `firstSeen` filter 90 min earlier → more flights caught → recomputes `extra_nm × 1.8 × 3.50` → returns updated total in the chat reply.

No map re-render for Tier 1. Map re-animation on chat input is R12 (Tier 2 stretch).

---

## Scope boundary (not building)

- No map re-render triggered by chat (Tier 2 / R12–R13)
- No persistent chat history across sessions
- No function calling / tool use (overkill)
- No user auth on the chat endpoint

---

## Dependencies

```bash
npm install @anthropic-ai/sdk
```

## Env var

```bash
# .env.local (git-ignored)
ANTHROPIC_API_KEY=sk-ant-...   # use rotated key — never the one exposed in shell history
```

---

## Demo prompts + cached fallbacks (pre-test before stage)

| Prompt | Cached fallback summary |
|---|---|
| "What happened to JBU1575?" | JBU1575 flew 373 nm toward Kingston, hit the SpaceX TFR wall at FL370, U-turned over the Bahamas, returned KFLL. Cost: ~$2,350 fuel + crew duty cycle. Kingston leg still owed. |
| "What are the 3 action options?" | 1. Hold at KFLL ($2–5k/hr) 2. Divert KMIA (gate fees + pax rebooking ~$8k) 3. Pre-empt via NOTAM watch — cheapest: pre-empt saves ~$10k vs hold. |
| "What if TFR started at 20:00Z?" | 3 additional flights caught in window. Network cost rises ~$12k. JetBlue adds JBU238 to watchlist. Coordination gap widens to ~$18k. |
| "Draft a crew message" | "Crew JBU1575: airspace closure Kingston FIR via SpaceX NOTAM active until 23:43Z. Return KFLL authorized. Ops will rebook pax. Duty extension approved. Stand by for gate assignment." |
| "What's the coordination gap?" | Network total: $41,200. JetBlue acting alone (selfish-optimal): same. If all carriers coordinated ground-stops 90 min earlier: ~$31,000. Gap = $10,200 — what awareness + coordination saves. |
