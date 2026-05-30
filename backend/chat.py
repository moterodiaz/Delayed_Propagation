import json, os
from pathlib import Path
from backend.models import StateModel

DATA = Path(__file__).resolve().parent.parent / "data"
_FALLBACK = json.loads((DATA / "chat_fallback.json").read_text())
MODEL = "claude-sonnet-4-6"
_GENERIC = ("I can summarize active disruptions, break down cost per event, recommend a priced action, "
            "or draft crew/ops comms. Try one of the demo prompts.")

def fallback_answer(message):
    key = message.strip().lower().rstrip("?")
    for k, v in _FALLBACK.items():
        if k.rstrip("?") == key: return v
    for k, v in _FALLBACK.items():
        if any(tok in key for tok in k.rstrip("?").split() if len(tok) > 4): return v
    return _GENERIC

def build_facts(state):
    lines = ["COMPUTED FACTS (use ONLY these numbers, do not invent any):"]
    for e in state.events:
        lines.append(f"- {e.name}: {len(e.affected_flight_ids)} affected flights, total cost ${e.cost.total_usd:,.0f} "
                     f"(fuel ${e.cost.fuel_usd:,.0f}, delay ${e.cost.delay_usd:,.0f}, crew ${e.cost.crew_usd:,.0f}).")
        lines.append(f"  Affected: {', '.join(e.affected_flight_ids)}.")
        for o in e.options:
            mark = " (CHEAPEST)" if o.cheapest else ""
            lines.append(f"  Option {o.kind}: ${o.cost_usd:,.0f}{mark} -- {o.rationale}")
    n = state.network
    lines.append(f"- Network: acting alone ${n.selfish_usd:,.0f} vs coordinated ${n.coordinated_usd:,.0f} (gap ${n.gap_usd:,.0f}).")
    lines.append("- Weather at KFLL/KMIA/MKJP is clear VFR -- airspace closure, not weather.")
    return "\n".join(lines)

def ask(message, state):
    facts = build_facts(state)
    try:
        import anthropic
        if not os.getenv("ANTHROPIC_API_KEY"): raise RuntimeError("no api key")
        client = anthropic.Anthropic()
        resp = client.messages.create(model=MODEL, max_tokens=400,
            system=("You are an airline operations assistant. Answer using ONLY the computed facts provided. "
                    "Never invent numbers. Be concise and operational.\n\n" + facts),
            messages=[{"role":"user","content":message}])
        return {"reply": resp.content[0].text, "source":"live"}
    except Exception:
        return {"reply": fallback_answer(message), "source":"fallback"}
