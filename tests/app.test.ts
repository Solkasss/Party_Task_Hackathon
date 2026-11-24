process.env.DATABASE_URL = "file:./test.db";
import { describe, it, expect, vi, beforeAll } from "vitest";

const cookieJar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => { cookieJar.set(name, value); },
    delete: (name: string) => { cookieJar.delete(name); },
  }),
}));

const req = (url: string, method = "GET", body?: unknown) =>
  new Request(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }) as never;

describe("Тусовка — Безпека, Надійність та Якість", () => {
  let reg: any, login: any, list: any, create: any, getEv: any, patchEv: any, delEv: any, joinEv: any, leaveEv: any, commentEv: any, upload: any;
  let cA = new Map<string, string>(), cB = new Map<string, string>(), cC = new Map<string, string>();
  let pubId = "", privId = "", token = "";
  const future = new Date(Date.now() + 86400000 * 7).toISOString();

  beforeAll(async () => {
    ({ POST: reg } = await import("@/app/api/auth/register/route"));
    ({ POST: login } = await import("@/app/api/auth/login/route"));
    ({ GET: list, POST: create } = await import("@/app/api/events/route"));
    ({ GET: getEv, PATCH: patchEv, DELETE: delEv } = await import("@/app/api/events/[id]/route"));
    ({ POST: joinEv, DELETE: leaveEv } = await import("@/app/api/events/[id]/register/route"));
    ({ POST: commentEv } = await import("@/app/api/events/[id]/comments/route"));
    ({ POST: upload } = await import("@/app/api/upload/route"));

    cookieJar.clear();
    await reg(req("http://localhost/api/auth/register", "POST", { name: "Автор", email: "a@test.com", password: "Password123" }));
    cA = new Map(cookieJar);

    cookieJar.clear();
    await reg(req("http://localhost/api/auth/register", "POST", { name: "Гість Б", email: "b@test.com", password: "Password123" }));
    cB = new Map(cookieJar);

    cookieJar.clear();
    await reg(req("http://localhost/api/auth/register", "POST", { name: "Гість В", email: "c@test.com", password: "Password123" }));
    cC = new Map(cookieJar);
  });

  it("1. Блокує гостей (401) та приховує passwordHash", async () => {
    cookieJar.clear();
    const r1 = await create(req("http://localhost/api/events", "POST", { title: "Тест", description: "Опис", startsAt: future, capacity: 5, coverUrl: "/default-cover.svg", isPrivate: false }));
    expect(r1.status).toBe(401);

    const r2 = await login(req("http://localhost/api/auth/login", "POST", { email: "a@test.com", password: "Password123" }));
    const d2 = await r2.json();
    expect(r2.status).toBe(200);
    expect(d2.user.passwordHash).toBeUndefined();
  });

  it("2. Пошук кирилицею, IDOR-захист (403) та приховування списку учасників", async () => {
    cookieJar.clear(); cA.forEach((v, k) => cookieJar.set(k, v));
    const cr = await create(req("http://localhost/api/events", "POST", { title: "Вечірка на даху", description: "Опис", startsAt: future, capacity: 1, coverUrl: "/default-cover.svg", isPrivate: false }));
    pubId = (await cr.json()).event.id;

    cookieJar.clear();
    const sr = await list(req("http://localhost/api/events?q=" + encodeURIComponent("вечірка")));
    expect((await sr.json()).events.some((e: any) => e.id === pubId)).toBe(true);

    cB.forEach((v, k) => cookieJar.set(k, v));
    const det = await getEv(req(`http://localhost/api/events/${pubId}`), { params: Promise.resolve({ id: pubId }) });
    expect((await det.json()).event.attendees).toBeUndefined();

    const p = await patchEv(req(`http://localhost/api/events/${pubId}`, "PATCH", { title: "Хак" }), { params: Promise.resolve({ id: pubId }) });
    expect(p.status).toBe(403);
    const d = await delEv(req(`http://localhost/api/events/${pubId}`, "DELETE"), { params: Promise.resolve({ id: pubId }) });
    expect(d.status).toBe(403);
  });

  it("3. Приватні події, інвайт-токен, ліміт місць і захист від SVG XSS", async () => {
    cookieJar.clear(); cA.forEach((v, k) => cookieJar.set(k, v));
    const cr = await create(req("http://localhost/api/events", "POST", { title: "Секрет", description: "Опис", startsAt: future, capacity: 5, coverUrl: "/default-cover.svg", isPrivate: true }));
    const ev = (await cr.json()).event;
    privId = ev.id; token = ev.inviteToken;

    cookieJar.clear(); cB.forEach((v, k) => cookieJar.set(k, v));
    expect((await getEv(req(`http://localhost/api/events/${privId}`), { params: Promise.resolve({ id: privId }) })).status).toBe(403);
    expect((await getEv(req(`http://localhost/api/events/${privId}?invite=${token}`), { params: Promise.resolve({ id: privId }) })).status).toBe(200);
    expect((await joinEv(req(`http://localhost/api/events/${privId}/register?invite=${token}`, "POST"), { params: Promise.resolve({ id: privId }) })).status).toBe(201);
    expect((await commentEv(req(`http://localhost/api/events/${privId}/comments?invite=${token}`, "POST", { content: "Ок" }), { params: Promise.resolve({ id: privId }) })).status).toBe(201);
    expect((await leaveEv(req(`http://localhost/api/events/${privId}/register?invite=${token}`, "DELETE"), { params: Promise.resolve({ id: privId }) })).status).toBe(200);

    expect((await joinEv(req(`http://localhost/api/events/${pubId}/register`, "POST"), { params: Promise.resolve({ id: pubId }) })).status).toBe(201);
    cookieJar.clear(); cC.forEach((v, k) => cookieJar.set(k, v));
    expect((await joinEv(req(`http://localhost/api/events/${pubId}/register`, "POST"), { params: Promise.resolve({ id: pubId }) })).status).toBe(400);

    const fd = new FormData();
    fd.append("file", new Blob(['<svg onload="alert(1)"></svg>'], { type: "image/svg+xml" }), "xss.svg");
    expect((await upload(new Request("http://localhost/api/upload", { method: "POST", body: fd }) as never)).status).toBe(400);
  });
});
