import { NextResponse } from "next/server";
import { getPrvxMetrics } from "@/lib/prvx";

export const revalidate = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getPrvxMetrics();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "s-maxage=60, stale-while-revalidate=300"
      }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
