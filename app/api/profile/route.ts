import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Необхідна авторизація" }, { status: 401 });
  }

  const [createdEvents, registeredEvents] = await Promise.all([
    // All own events — include inviteToken so author can copy the link
    prisma.event.findMany({
      where: { authorId: user.id },
      orderBy: { startsAt: "desc" },
      include: {
        _count: { select: { attendances: true } },
      },
    }),
    // Events the user is registered for — explicitly exclude inviteToken
    prisma.event.findMany({
      where: {
        attendances: { some: { userId: user.id } },
      },
      orderBy: { startsAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        startsAt: true,
        capacity: true,
        coverUrl: true,
        isPrivate: true,
        authorId: true,
        createdAt: true,
        updatedAt: true,
        author: { select: { id: true, name: true } },
        _count: { select: { attendances: true } },
      },
    }),
  ]);

  return NextResponse.json({ createdEvents, registeredEvents }, { status: 200 });
}
