import { describe, it, expect, vi, beforeAll } from "vitest";
import { NextRequest } from "next/server";

const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = cookieJar.get(name);
      return value ? { name, value } : undefined;
    },
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

import { POST as registerUser } from "@/app/api/auth/register/route";
import { POST as loginUser } from "@/app/api/auth/login/route";
import { GET as listEvents, POST as createEvent } from "@/app/api/events/route";
import {
  GET as getEvent,
  PATCH as updateEvent,
  DELETE as deleteEvent,
} from "@/app/api/events/[id]/route";
import {
  POST as registerForEvent,
  DELETE as unregisterFromEvent,
} from "@/app/api/events/[id]/register/route";
import { POST as postComment } from "@/app/api/events/[id]/comments/route";
import { POST as uploadCover } from "@/app/api/upload/route";

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("Тусовка — Аудит безпеки, надійності та якості", () => {
  let userACookies = new Map<string, string>();
  let userBCookies = new Map<string, string>();
  let userCCookies = new Map<string, string>();
  let publicEventId = "";
  let privateEventId = "";
  let privateInviteToken = "";

  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  beforeAll(async () => {
    // Register User A (author)
    cookieJar.clear();
    const resA = await registerUser(
      jsonReq("http://localhost/api/auth/register", "POST", {
        name: "Автор Олексій",
        email: "author@example.com",
        password: "Password123",
      })
    );
    expect(resA.status).toBe(201);
    userACookies = new Map(cookieJar);

    // Register User B (attacker / guest)
    cookieJar.clear();
    const resB = await registerUser(
      jsonReq("http://localhost/api/auth/register", "POST", {
        name: "Гість Марія",
        email: "guest@example.com",
        password: "Password123",
      })
    );
    expect(resB.status).toBe(201);
    userBCookies = new Map(cookieJar);

    // Register User C (for race condition test)
    cookieJar.clear();
    const resC = await registerUser(
      jsonReq("http://localhost/api/auth/register", "POST", {
        name: "Гість Іван",
        email: "ivan@example.com",
        password: "Password123",
      })
    );
    expect(resC.status).toBe(201);
    userCCookies = new Map(cookieJar);
  });

  it("1. Захист автентифікації: блокує неавторизованих (401) і не розкриває passwordHash", async () => {
    cookieJar.clear();
    const unauthRes = await createEvent(
      jsonReq("http://localhost/api/events", "POST", {
        title: "Тестова подія",
        description: "Опис",
        startsAt: futureDate,
        capacity: 5,
        coverUrl: "/default-cover.svg",
        isPrivate: false,
      })
    );
    expect(unauthRes.status).toBe(401);

    const loginRes = await loginUser(
      jsonReq("http://localhost/api/auth/login", "POST", {
        email: "author@example.com",
        password: "Password123",
      })
    );
    const loginData = await loginRes.json();
    expect(loginRes.status).toBe(200);
    expect(loginData.user.passwordHash).toBeUndefined();
  });

  it("2. Створення подій, пошук кирилицею без урахування регістру та приховування списку учасників", async () => {
    cookieJar.clear();
    userACookies.forEach((v, k) => cookieJar.set(k, v));

    const createRes = await createEvent(
      jsonReq("http://localhost/api/events", "POST", {
        title: "Вечірка біля озера",
        description: "Крутий вечір",
        startsAt: futureDate,
        capacity: 1,
        coverUrl: "/default-cover.svg",
        isPrivate: false,
      })
    );
    expect(createRes.status).toBe(201);
    const created = await createRes.json();
    publicEventId = created.event.id;

    // Case-insensitive Cyrillic search
    cookieJar.clear();
    const searchRes = await listEvents(
      new NextRequest("http://localhost/api/events?q=" + encodeURIComponent("вечірка"))
    );
    const searchData = await searchRes.json();
    expect(searchData.events.some((e: { id: string }) => e.id === publicEventId)).toBe(true);

    // Non-author must NOT see attendees array
    userBCookies.forEach((v, k) => cookieJar.set(k, v));
    const detailRes = await getEvent(
      new NextRequest(`http://localhost/api/events/${publicEventId}`),
      { params: Promise.resolve({ id: publicEventId }) }
    );
    const detailData = await detailRes.json();
    expect(detailData.event.attendees).toBeUndefined();
  });

  it("3. IDOR-захист: користувач Б не може змінити або видалити подію користувача А (403)", async () => {
    cookieJar.clear();
    userBCookies.forEach((v, k) => cookieJar.set(k, v));

    const patchRes = await updateEvent(
      jsonReq(`http://localhost/api/events/${publicEventId}`, "PATCH", {
        title: "Зламано",
      }),
      { params: Promise.resolve({ id: publicEventId }) }
    );
    expect(patchRes.status).toBe(403);

    const delRes = await deleteEvent(
      new NextRequest(`http://localhost/api/events/${publicEventId}`, { method: "DELETE" }),
      { params: Promise.resolve({ id: publicEventId }) }
    );
    expect(delRes.status).toBe(403);
  });

  it("4. Приватні події: приховані з пошуку, блокуються без токена і працюють з інвайт-токеном", async () => {
    cookieJar.clear();
    userACookies.forEach((v, k) => cookieJar.set(k, v));

    const res = await createEvent(
      jsonReq("http://localhost/api/events", "POST", {
        title: "Секретний мітап",
        description: "Тільки для своїх",
        startsAt: futureDate,
        capacity: 5,
        coverUrl: "/default-cover.svg",
        isPrivate: true,
      })
    );
    const data = await res.json();
    privateEventId = data.event.id;
    privateInviteToken = data.event.inviteToken;
    expect(privateInviteToken).toBeTruthy();

    // Hidden from public feed & search
    cookieJar.clear();
    const feedRes = await listEvents(
      new NextRequest("http://localhost/api/events?q=" + encodeURIComponent("секретний"))
    );
    const feedData = await feedRes.json();
    expect(feedData.events.some((e: { id: string }) => e.id === privateEventId)).toBe(false);

    // Blocked without token
    userBCookies.forEach((v, k) => cookieJar.set(k, v));
    const forbiddenRes = await getEvent(
      new NextRequest(`http://localhost/api/events/${privateEventId}`),
      { params: Promise.resolve({ id: privateEventId }) }
    );
    expect(forbiddenRes.status).toBe(403);

    // Allowed with valid invite token (view, register, comment, unregister)
    const allowedRes = await getEvent(
      new NextRequest(`http://localhost/api/events/${privateEventId}?invite=${privateInviteToken}`),
      { params: Promise.resolve({ id: privateEventId }) }
    );
    expect(allowedRes.status).toBe(200);

    const regRes = await registerForEvent(
      new NextRequest(`http://localhost/api/events/${privateEventId}/register?invite=${privateInviteToken}`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: privateEventId }) }
    );
    expect(regRes.status).toBe(201);

    const commentRes = await postComment(
      jsonReq(
        `http://localhost/api/events/${privateEventId}/comments?invite=${privateInviteToken}`,
        "POST",
        { content: "Дякую за запрошення!" }
      ),
      { params: Promise.resolve({ id: privateEventId }) }
    );
    expect(commentRes.status).toBe(201);

    const unregRes = await unregisterFromEvent(
      new NextRequest(`http://localhost/api/events/${privateEventId}/register?invite=${privateInviteToken}`, {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: privateEventId }) }
    );
    expect(unregRes.status).toBe(200);
  });

  it("5. Захист від overbooking: на 1 місце може записатися лише 1 користувач, другий отримує 400", async () => {
    cookieJar.clear();
    userBCookies.forEach((v, k) => cookieJar.set(k, v));
    const res1 = await registerForEvent(
      new NextRequest(`http://localhost/api/events/${publicEventId}/register`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: publicEventId }) }
    );
    expect(res1.status).toBe(201);

    cookieJar.clear();
    userCCookies.forEach((v, k) => cookieJar.set(k, v));
    const res2 = await registerForEvent(
      new NextRequest(`http://localhost/api/events/${publicEventId}/register`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: publicEventId }) }
    );
    expect(res2.status).toBe(400);

    // Author cannot lower capacity below current attendees (1 -> invalid if 0, let's test invalid UUID 404)
    const badIdRes = await getEvent(
      new NextRequest("http://localhost/api/events/not-a-valid-uuid"),
      { params: Promise.resolve({ id: "not-a-valid-uuid" }) }
    );
    expect(badIdRes.status).toBe(404);
  });

  it("6. XSS-захист завантаження: відхиляє SVG-файли (400)", async () => {
    cookieJar.clear();
    userACookies.forEach((v, k) => cookieJar.set(k, v));

    const fd = new FormData();
    fd.append("file", new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/svg+xml" }), "xss.svg");

    const uploadRes = await uploadCover(
      new NextRequest("http://localhost/api/upload", {
        method: "POST",
        body: fd,
      })
    );
    expect(uploadRes.status).toBe(400);
  });
});
