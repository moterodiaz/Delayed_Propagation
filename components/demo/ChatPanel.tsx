"use client";
import { useState, useRef, useEffect } from "react";

interface Msg {
  role: "user" | "assistant";
  text: string;
  source?: string;
}

const CHIPS = [
  "What's hitting us right now?",
  "Break down the SpaceX impact",
  "What should I do about JBU1575?",
  "Draft a note to the crew",
  "What's the network picture?",
];

export default function ChatPanel() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, busy]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: q }),
      });
      const data = (await res.json()) as { reply: string; source?: string };
      setMsgs((m) => [...m, { role: "assistant", text: data.reply, source: data.source }]);
    } catch {
      setMsgs((m) => [...m, { role: "assistant", text: "Connection error — try again.", source: "error" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "rgba(2,8,22,0.98)", borderTop: "1px solid rgba(0,160,255,0.09)" }}>
      <div style={{ padding: "11px 14px", flexShrink: 0, borderBottom: "1px solid rgba(0,160,255,0.07)", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13 }}>🤖</span>
        <span style={{ fontSize: 9, fontWeight: 700, color: "#4a6a8a", letterSpacing: 3 }}>OPS ASSISTANT</span>
      </div>

      {/* messages */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px", display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.length === 0 && (
          <div style={{ textAlign: "center", padding: "16px 0", fontSize: 10, color: "#1e3050", letterSpacing: 2 }}>
            ASK ABOUT IMPACT, OPTIONS, OR COMMS
          </div>
        )}
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "85%" }}>
            <div style={{
              background: m.role === "user" ? "rgba(0,200,255,0.12)" : "rgba(6,16,38,0.9)",
              border: m.role === "user" ? "1px solid rgba(0,200,255,0.3)" : "1px solid rgba(0,160,255,0.12)",
              borderRadius: 8, padding: "8px 11px", fontSize: 12, lineHeight: 1.5,
              color: m.role === "user" ? "#c8e0f8" : "#b8d4ec", whiteSpace: "pre-wrap",
            }}>
              {m.text}
            </div>
            {m.source && m.role === "assistant" && (
              <div style={{ fontSize: 8, letterSpacing: 1, marginTop: 2, color: m.source === "live" ? "#00ff88" : "#4a6a8a" }}>
                {m.source === "live" ? "● LIVE" : "○ CACHED"}
              </div>
            )}
          </div>
        ))}
        {busy && <div style={{ alignSelf: "flex-start", fontSize: 11, color: "#4a6a8a" }}>…thinking</div>}
        <div ref={endRef} />
      </div>

      {/* chips */}
      <div style={{ flexShrink: 0, padding: "6px 10px", display: "flex", flexWrap: "wrap", gap: 5, borderTop: "1px solid rgba(0,160,255,0.06)" }}>
        {CHIPS.map((c) => (
          <button key={c} onClick={() => send(c)} disabled={busy} style={{
            fontSize: 9, color: "#7aa8d0", background: "rgba(0,200,255,0.06)",
            border: "1px solid rgba(0,160,255,0.18)", borderRadius: 12, padding: "3px 8px", cursor: "pointer",
          }}>{c}</button>
        ))}
      </div>

      {/* input */}
      <form
        onSubmit={(ev) => { ev.preventDefault(); send(input); }}
        style={{ flexShrink: 0, display: "flex", gap: 6, padding: "8px 10px", borderTop: "1px solid rgba(0,160,255,0.08)" }}
      >
        <input
          value={input}
          onChange={(ev) => setInput(ev.target.value)}
          placeholder="Ask the ops assistant…"
          style={{ flex: 1, background: "rgba(6,16,38,0.9)", border: "1px solid rgba(0,160,255,0.18)", borderRadius: 6, padding: "8px 10px", fontSize: 12, color: "#c8e0f8", outline: "none" }}
        />
        <button type="submit" disabled={busy} style={{ background: "#00c8ff", color: "#021018", border: "none", borderRadius: 6, padding: "0 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Send</button>
      </form>
    </div>
  );
}
