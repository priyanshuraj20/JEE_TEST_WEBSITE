import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getSession();
  session.isAdmin = false;
  await session.save();
  return NextResponse.json({ ok: true });
}
