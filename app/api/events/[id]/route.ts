import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uuidSchema, updateEventSchema } from "@/lib/validations";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

// ── GET /api/events/[id] ──────────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true } },
      _count: { select: { attendances: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true } } },
      },
      attendances: {
        orderBy: { createdAt: "asc" },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  const { searchParams } = new URL(request.url);
  const invite = searchParams.get("invite");

  // Access control for private events
  if (event.isPrivate) {
    const isAuthorAccess = currentUser?.id === event.authorId;
    const isInviteValid = Boolean(invite) && invite === event.inviteToken;
    if (!isAuthorAccess && !isInviteValid) {
      return NextResponse.json(
        {
          error:
            "Це приватна подія. Потрібне дійсне посилання-запрошення",
        },
        { status: 403 }
      );
    }
  }

  const isAuthor = currentUser?.id === event.authorId;
  const isRegistered = currentUser
    ? event.attendances.some((a) => a.userId === currentUser.id)
    : false;

  // Strip sensitive fields before sending
  const { attendances, inviteToken: _inviteToken, _count, ...safeEvent } = event;

  return NextResponse.json(
    {
      event: {
        ...safeEvent,
        attendeesCount: _count.attendances,
        isRegistered,
        isAuthor,
        // Only expose attendee list and invite token to the event author
        ...(isAuthor
          ? {
              inviteToken: event.inviteToken,
              attendees: attendances.map((a) => a.user),
            }
          : {}),
      },
    },
    { status: 200 }
  );
}

// ── PATCH /api/events/[id] ────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: "Необхідна авторизація" },
      { status: 401 }
    );
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: { _count: { select: { attendances: true } } },
  });

  if (!event) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  // IDOR check
  if (event.authorId !== currentUser.id) {
    return NextResponse.json(
      { error: "Ви не можете редагувати чужу подію" },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Невірний JSON" }, { status: 400 });
  }

  const result = updateEventSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    );
  }

  const data = result.data;

  // Capacity guard
  if (
    data.capacity !== undefined &&
    data.capacity < event._count.attendances
  ) {
    return NextResponse.json(
      {
        error:
          "Кількість місць не може бути меншою за кількість вже зареєстрованих учасників",
      },
      { status: 400 }
    );
  }

  // Manage inviteToken lifecycle
  let inviteToken = event.inviteToken;
  if (data.isPrivate === true && !event.inviteToken) {
    inviteToken = crypto.randomUUID();
  } else if (data.isPrivate === false) {
    inviteToken = null;
  }

  const updated = await prisma.event.update({
    where: { id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.startsAt !== undefined && { startsAt: new Date(data.startsAt) }),
      ...(data.capacity !== undefined && { capacity: data.capacity }),
      ...(data.coverUrl !== undefined && { coverUrl: data.coverUrl }),
      ...(data.isPrivate !== undefined && { isPrivate: data.isPrivate }),
      inviteToken,
    },
  });

  return NextResponse.json({ event: updated }, { status: 200 });
}

// ── DELETE /api/events/[id] ───────────────────────────────────────────────────

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: "Необхідна авторизація" },
      { status: 401 }
    );
  }

  const event = await prisma.event.findUnique({ where: { id } });

  if (!event) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  // IDOR check
  if (event.authorId !== currentUser.id) {
    return NextResponse.json(
      { error: "Ви не можете видалити чужу подію" },
      { status: 403 }
    );
  }

  await prisma.event.delete({ where: { id } });

  return NextResponse.json({ ok: true }, { status: 200 });
}
