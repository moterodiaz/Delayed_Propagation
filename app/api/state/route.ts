import { NextResponse } from "next/server";
import { buildState } from "@/lib/airspace/state";

export const runtime = "nodejs";
export const dynamic = "force-static"; // deterministic snapshot (R9)

export function GET() {
  return NextResponse.json(buildState());
}
