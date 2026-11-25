import { NextResponse } from "next/server";
import { getPublicEnv, getServerEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const publicEnv = getPublicEnv();
  const serverEnv = getServerEnv();

  return NextResponse.json(
    {
      status: "ok",
      service: "modarrag",
      defaultSchoolSlug: publicEnv.NEXT_PUBLIC_DEFAULT_SCHOOL_SLUG,
      capabilities: {
        upstashRateLimit: serverEnv.isUpstashConfigured,
        turnstileVerification: serverEnv.isTurnstileConfigured,
        serviceRoleConfigured: Boolean(serverEnv.SUPABASE_SERVICE_ROLE_KEY),
      },
      timestamp: new Date().toISOString(),
    },
    { status: 200 }
  );
}
