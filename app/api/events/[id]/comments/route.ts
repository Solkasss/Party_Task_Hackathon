import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { uuidSchema } from "@/lib/validations";

type Params = { params: Promise<{ id: string }> };

const commentSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "Коментар не може бути порожнім")
    .max(1000, "Коментар не може перевищувати 1000 символів"),
  invite: z.string().optional(),
});

// ── POST /api/events/[id]/comments ────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!uuidSchema.safeParse(id).success) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json({ error: "Необхідна авторизація" }, { status: 401 });
  }

  // Parse body first so we can read both content and optional invite token
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Невірний JSON" }, { status: 400 });
  }

  const result = commentSchema.safeParse(body);
  if (!result.success) {
    return NextResponse.json(
      { error: result.error.errors[0].message },
      { status: 400 }
    );
  }

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return NextResponse.json({ error: "Подію не знайдено" }, { status: 404 });
  }

  // Private event access check
  if (event.isPrivate) {
    const { searchParams } = new URL(request.url);
    const invite = searchParams.get("invite") ?? result.data.invite;
    const isAuthor = currentUser.id === event.authorId;
    const isInviteValid = Boolean(invite) && invite === event.inviteToken;
    if (!isAuthor && !isInviteValid) {
      return NextResponse.json(
        { error: "Це приватна подія. Потрібне дійсне посилання-запрошення" },
        { status: 403 }
      );
    }
  }

  const comment = await prisma.comment.create({
    data: {
      content: result.data.content,
      userId: currentUser.id,
      eventId: id,
    },
    include: {
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ comment }, { status: 201 });
}
