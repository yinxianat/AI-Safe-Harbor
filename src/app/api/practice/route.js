import { getSessionUser } from "@/lib/auth.js";
import { parseJsonBody, badRequest } from "@/lib/http.js";
import { practiceChat } from "@/lib/ai/index.js";
import prisma from "@/lib/db.js";

const MAX_TURNS = 20;
const MAX_SESSIONS = 50;

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("id");

  if (sessionId) {
    const session = await prisma.practiceSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }
    return Response.json({
      session: { ...session, turns: JSON.parse(session.turns) },
    });
  }

  const sessions = await prisma.practiceSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, topic: true, createdAt: true, updatedAt: true, aiTip: true },
  });

  return Response.json({ sessions });
}

export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await parseJsonBody(request);
  if (!body.ok) return badRequest("invalid_json");

  const { sessionId, message, topic } = body.data;

  if (sessionId) {
    const session = await prisma.practiceSession.findUnique({ where: { id: sessionId } });
    if (!session || session.userId !== user.id) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    const turns = JSON.parse(session.turns);
    if (turns.length >= MAX_TURNS * 2) {
      return Response.json(
        { error: "session_full", detail: "This practice session has reached its limit. Start a new one." },
        { status: 400 }
      );
    }

    if (!message || typeof message !== "string" || message.length > 2000) {
      return badRequest("invalid_message");
    }

    turns.push({ role: "user", content: message });

    const aiResult = await practiceChat(session.topic, turns);
    if (aiResult.error) {
      return Response.json(
        { error: aiResult.error, detail: "AI is temporarily unavailable. Try again shortly." },
        { status: 503 }
      );
    }

    turns.push({ role: "assistant", content: aiResult.reply });

    await prisma.practiceSession.update({
      where: { id: sessionId },
      data: { turns: JSON.stringify(turns) },
    });

    return Response.json({
      reply: aiResult.reply,
      turns,
      provider: aiResult.provider,
    });
  }

  if (!topic || typeof topic !== "string" || topic.length > 200) {
    return badRequest("invalid_topic");
  }

  const count = await prisma.practiceSession.count({ where: { userId: user.id } });
  if (count >= MAX_SESSIONS) {
    const oldest = await prisma.practiceSession.findFirst({
      where: { userId: user.id },
      orderBy: { updatedAt: "asc" },
    });
    if (oldest) await prisma.practiceSession.delete({ where: { id: oldest.id } });
  }

  const aiResult = await practiceChat(topic, []);
  const turns = aiResult.reply
    ? [{ role: "assistant", content: aiResult.reply }]
    : [];

  const session = await prisma.practiceSession.create({
    data: {
      userId: user.id,
      topic,
      turns: JSON.stringify(turns),
    },
  });

  return Response.json({
    session: { ...session, turns },
    reply: aiResult.reply,
  }, { status: 201 });
}
