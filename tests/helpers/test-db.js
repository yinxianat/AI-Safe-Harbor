import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client.js";

const databaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const adapter = new PrismaPg({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter });

export async function createTestUser(email, name) {
  return prisma.user.create({
    data: { email, displayName: name },
  });
}

export async function createTestConnection(userAId, userBId) {
  return prisma.connection.create({
    data: {
      userAId,
      userBId,
      relationshipType: "spouse",
      status: "active",
    },
  });
}

export async function setTopicSetting(connectionId, userId, topicName, comfortLevel) {
  return prisma.topicSetting.upsert({
    where: {
      connectionId_userId_topicName: { connectionId, userId, topicName },
    },
    update: { comfortLevel },
    create: { connectionId, userId, topicName, comfortLevel },
  });
}

export async function createMessage(connectionId, senderId, data) {
  return prisma.message.create({
    data: {
      connectionId,
      senderId,
      contentRaw: data.contentRaw,
      contentRephrased: data.contentRephrased || null,
      versionSent: data.versionSent || null,
      senderApproved: data.senderApproved || false,
      status: data.status || "draft",
      topicTags: data.topicTags || [],
      sentAt: data.status === "sent" ? new Date() : null,
    },
  });
}

export async function cleanup() {
  await prisma.message.deleteMany();
  await prisma.topicSetting.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.magicToken.deleteMany();
  await prisma.user.deleteMany();
}

export { prisma };
