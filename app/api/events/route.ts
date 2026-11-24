import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { createEventSchema } from "@/lib/validations";
import crypto from "crypto";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const rawEvents = await prisma.event.findMany({
    where: {
      isPrivate: false,
      startsAt: { gt: new Date() },
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
      author: { select: { id: true, name: true } },
      _count: { select: { attendances: true } },
    },
  });

  const events = q
    ? rawEvents.filter((e) => e.title.toLowerCase().includes(q))
    : rawEvents;

  return NextResponse.json({ events }, { status: 200 });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { error: "Необхідна авторизація" },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Невірний JSON" }, { status: 400 });
  }

  const result = createEventSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    );
  }

  const { title, description, startsAt, capacity, coverUrl, isPrivate } =
    result.data;

  const inviteToken = isPrivate ? crypto.randomUUID() : null;

  const event = await prisma.event.create({
    data: {
      title,
      description,
      startsAt: new Date(startsAt),
      capacity,
      coverUrl,
      isPrivate,
      inviteToken,
      authorId: user.id,
    },
  });

  return NextResponse.json({ event }, { status: 201 });
}
