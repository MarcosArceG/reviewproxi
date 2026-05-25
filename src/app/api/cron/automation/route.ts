import { NextResponse } from "next/server";
import { verifyCronRequest } from "@/lib/cron/auth";
import { runDailyAutomation } from "@/lib/reviews/run-daily-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** En Vercel Pro se puede subir (p. ej. 300). En Hobby el límite efectivo suele ser ~10s. */
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!verifyCronRequest(req)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "Falta CRON_SECRET en variables de entorno" },
      { status: 500 }
    );
  }

  try {
    const result = await runDailyAutomation({ syncFirst: true });
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("CRON automation error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Error en cron de automatización",
      },
      { status: 500 }
    );
  }
}
