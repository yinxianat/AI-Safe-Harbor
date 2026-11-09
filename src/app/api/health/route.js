import prisma from "@/lib/db.js";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok", database: "connected" });
  } catch {
    return Response.json(
      { status: "degraded", database: "unreachable" },
      { status: 503 }
    );
  }
}
