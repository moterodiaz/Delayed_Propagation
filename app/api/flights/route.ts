import { NextResponse } from "next/server";

const OPENSKY =
  "https://opensky-network.org/api/states/all" +
  "?lamin=17&lomin=-83&lamax=27&lomax=-72";

export async function GET() {
  try {
    const res = await fetch(OPENSKY, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ states: null }, { status: res.status });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ states: null }, { status: 502 });
  }
}
