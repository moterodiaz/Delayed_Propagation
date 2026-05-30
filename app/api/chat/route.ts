import { NextResponse } from "next/server";
import { buildState } from "@/lib/airspace/state";
import { ask } from "@/lib/airspace/chat";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let message = "";
  try {
    const body = (await req.json()) as { message?: string };
    message = (body.message ?? "").toString();
  } catch {
    message = "";
  }
  if (!message.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }
  const result = await ask(message, buildState());
  return NextResponse.json(result);
}
