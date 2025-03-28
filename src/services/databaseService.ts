import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function saveGeneratedImage(prompt: string, imageUrl: string, userId?: string) {
  return prisma.generatedImage.create({
    data: {
      prompt,
      imageUrl,
      userId,
    },
  });
}

export async function getRecentGeneratedImages(limit = 5) {
  return prisma.generatedImage.findMany({
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

export async function getUserGeneratedImages(userId: string, limit = 5) {
  return prisma.generatedImage.findMany({
    where: {
      userId,
    },
    take: limit,
    orderBy: {
      createdAt: 'desc',
    },
  });
} 