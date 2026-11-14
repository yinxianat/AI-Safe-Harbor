/**
 * Conversation thread for a connection. Returns sent messages in both
 * directions, ordered chronologically, so the chat page can render a
 * unified timeline. The receiver never sees contentRaw — only the sender
 * gets their own original alongside the rephrased version.
 */
import { getSessionUser } from "@/lib/auth.js";
import { findAccessibleConnection, getPartnerId } from "@/lib/connections.js";
import prisma from "@/lib/db.js";
import { shieldTexts } from "@/lib/ai/apply-shield.js";

const PERSON = { select: { id: true, displayName: true, username: true, email: true, avatarUrl: true } };

function personName(p) {
  return p.displayName || (p.username ? `@${p.username}` : p.email);
}

export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const connectionId = searchParams.get("connectionId");
  if (!connectionId) {
    return Response.json({ error: "missing_connectionId" }, { status: 400 });
  }

  const connection = await findAccessibleConnection(user.id, connectionId);
  if (!connection) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const partnerId = getPartnerId(connection, user.id);
  const [partner, myPref] = await Promise.all([
    prisma.user.findUnique({ where: { id: partnerId }, ...PERSON }),
    prisma.connectionPreference.findUnique({
      where: { connectionId_userId: { connectionId, userId: user.id } },
      select: { nickname: true },
    }),
  ]);

  const messages = await prisma.message.findMany({
    where: {
      connectionId,
      status: "sent",
      senderApproved: true,
      versionSent: "rephrased",
    },
    select: {
      id: true,
      senderId: true,
      contentRaw: true,
      contentRephrased: true,
      sentAt: true,
      reaction: true,
      readAt: true,
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  });

  messages.reverse();

  const kept = messages.filter((m) => m.contentRephrased);

  // Shield only the UNREAD received messages. Already-read messages have
  // already been seen in their original form, so softening them on a
  // re-read would misrepresent what the reader saw before. Unread ones are
  // what the reader is about to see — the shield's actual job.
  const shieldableIndexes = kept
    .map((m, i) => ({ m, i }))
    .filter(({ m }) => m.senderId !== user.id && !m.readAt);
  const shielded = await shieldTexts(
    user,
    shieldableIndexes.map(({ m }) => m.contentRephrased)
  );
  const shieldByIndex = new Map(
    shieldableIndexes.map(({ i }, k) => [i, shielded[k]])
  );

  const formatted = kept.map((m, i) => {
    const isMine = m.senderId === user.id;
    const s = shieldByIndex.get(i);
    return {
      id: m.id,
      direction: isMine ? "sent" : "received",
      content: s ? s.text : m.contentRephrased,
      softened: s ? s.softened : false,
      // Only the sender may see their own original wording.
      contentRaw: isMine ? m.contentRaw : null,
      sentAt: m.sentAt?.toISOString(),
      reaction: m.reaction || null,
      readAt: m.readAt?.toISOString() || null,
    };
  });

  // Mark received messages as read while we have them.
  const unreadIds = messages
    .filter((m) => m.senderId !== user.id && !m.readAt)
    .map((m) => m.id);

  if (unreadIds.length > 0) {
    await prisma.message.updateMany({
      where: { id: { in: unreadIds } },
      data: { readAt: new Date() },
    });
  }

  return Response.json({
    messages: formatted,
    partner: partner ? {
      id: partner.id,
      displayName: partner.displayName,
      username: partner.username,
      avatarUrl: partner.avatarUrl || null,
      // The chat header has to agree with the chat list, which shows the
      // reader's own label for this person rather than the name they set.
      name: myPref?.nickname || personName(partner),
      realName: personName(partner),
    } : null,
    connectionId,
  });
}
