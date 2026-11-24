import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

// ── POST /api/events/[id]/register ────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Необхідна авторизація" }, { status: 401 });
  }

  // Read invite token from query param first, then try JSON body
  const { searchParams } = new URL(request.url);
  const inviteParam = searchParams.get("invite");

  let bodyInvite: string | null = null;
  if (!inviteParam) {
    try {
      const body = await request.json();
      bodyInvite = typeof body?.invite === "string" ? body.invite : null;
    } catch {
      // no body or non-JSON — that's fine
    }
  }

  const invite = inviteParam ?? bodyInvite;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  // Private event access check
  if (event.isPrivate) {
    const isAuthor = currentUser.id === event.authorId;
    const isInviteValid = Boolean(invite) && invite === event.inviteToken;
    if (!isAuthor && !isInviteValid) {
      return NextResponse.json(
        { error: "Це приватна подія. Потрібне дійсне посилання-запрошення" },
        { status: 403 }
      );
    }
  }

  // Reject if event already started
  if (event.startsAt <= new Date()) {
    return NextResponse.json(
      { error: "Подія вже почалася або завершилася" },
      { status: 400 }
    );
  }

  // Concurrency-safe registration inside transaction
  try {
    await prisma.$transaction(async (tx) => {
      const count = await tx.registration.count({ where: { eventId: id } });
      if (count >= event.capacity) {
        throw new Error("CAPACITY_FULL");
      }
      await tx.registration.create({
        data: { userId: currentUser.id, eventId: id },
      });
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CAPACITY_FULL") {
      return NextResponse.json({ error: "Вільних місць немає" }, { status: 400 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Ви вже записані на цю подію" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Внутрішня помилка сервера" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

// ── DELETE /api/events/[id]/register ─────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Необхідна авторизація" }, { status: 401 });
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  if (event.startsAt <= new Date()) {
    return NextResponse.json(
      { error: "Неможливо скасувати запис на подію, що вже почалася" },
      { status: 400 }
    );
  }

  // deleteMany never throws if record is absent
  await prisma.registration.deleteMany({
    where: { userId: currentUser.id, eventId: id },
  });

  return NextResponse.json({ ok: true }, { status: 200 });
}
