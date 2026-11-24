"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  Calendar,
  Users,
  Lock,
  Copy,
  Trash2,
  Pencil,
  Send,
} from "lucide-react";

type AuthUser = { id: string; name: string; email: string } | null;

type Comment = {
  id: string;
  content: string;
  createdAt: string;
  user: { id: string; name: string };
};

type Attendee = { id: string; name: string; email: string };

type EventDetail = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
  coverUrl: string;
  isPrivate: boolean;
  author: { id: string; name: string };
  attendeesCount: number;
  isRegistered: boolean;
  isAuthor: boolean;
  inviteToken?: string | null;
  attendees?: Attendee[];
  comments: Comment[];
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("uk-UA", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Inner content (uses useSearchParams — must be wrapped in Suspense) ─────────

function EventPageContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params?.id;
  const invite = searchParams.get("invite");

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | undefined>(
    undefined
  );
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);

  const [copied, setCopied] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // ── Fetch event + current user in parallel ──────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [eventRes, meRes] = await Promise.all([
        fetch(`/api/events/${id}${invite ? `?invite=${invite}` : ""}`),
        fetch("/api/auth/me"),
      ]);
      const [eventData, meData] = await Promise.all([
        eventRes.json(),
        meRes.json(),
      ]);

      if (!eventRes.ok) {
        setPageError(eventData.error ?? "Помилка завантаження події");
        return;
      }
      setEvent(eventData.event);
      setCurrentUser(meData.user ?? null);
    } catch {
      setPageError("Помилка з'єднання");
    } finally {
      setLoading(false);
    }
  }, [id, invite]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Registration ────────────────────────────────────────────────────────────
  async function handleRegister() {
    if (!currentUser) {
      router.push("/login");
      return;
    }
    setRegError("");
    setRegLoading(true);
    try {
      const qs = invite ? `?invite=${invite}` : "";
      const res = await fetch(`/api/events/${id}/register${qs}`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error ?? "Помилка реєстрації");
        return;
      }
      await fetchData();
    } catch {
      setRegError("Помилка з'єднання");
    } finally {
      setRegLoading(false);
    }
  }

  async function handleCancel() {
    setRegError("");
    setRegLoading(true);
    try {
      const res = await fetch(`/api/events/${id}/register`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error ?? "Помилка скасування");
        return;
      }
      await fetchData();
    } catch {
      setRegError("Помилка з'єднання");
    } finally {
      setRegLoading(false);
    }
  }

  // ── Comment ─────────────────────────────────────────────────────────────────
  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommentLoading(true);
    try {
      const qs = invite ? `?invite=${invite}` : "";
      const res = await fetch(`/api/events/${id}/comments${qs}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error ?? "Помилка додавання коментаря");
        return;
      }
      setComment("");
      await fetchData();
    } catch {
      setRegError("Помилка з'єднання");
    } finally {
      setCommentLoading(false);
    }
  }

  // ── Delete ──────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!confirm("Ви впевнені, що хочете видалити цю подію? Цю дію не можна скасувати."))
      return;
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Copy invite link ────────────────────────────────────────────────────────
  function copyInviteLink() {
    if (!event?.inviteToken) return;
    const url = `${window.location.origin}/events/${event.id}?invite=${event.inviteToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="text-center py-24 text-gray-400 text-sm">
        Завантаження…
      </div>
    );
  }
  if (pageError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-red-600 text-lg mb-4">{pageError}</p>
        <Link href="/" className="text-indigo-600 hover:underline text-sm">
          ← На головну
        </Link>
      </div>
    );
  }
  if (!event) return null;

  const isPast = new Date(event.startsAt) <= new Date();
  const spotsLeft = event.capacity - event.attendeesCount;
  const isFull = spotsLeft <= 0;
  const isGuest = currentUser === null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Cover */}
      <div className="relative h-72 w-full rounded-2xl overflow-hidden mb-8 shadow-sm">
        <Image
          src={event.coverUrl || "/default-cover.svg"}
          alt={event.title}
          fill
          className="object-cover"
          unoptimized
        />
        {event.isPrivate && (
          <span className="absolute top-4 left-4 inline-flex items-center gap-1.5 bg-gray-900/70 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            <Lock className="w-3 h-3" /> Приватна подія
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Left column ── */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-3">
              {event.title}
            </h1>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {event.description}
            </p>
          </div>

          {/* Author actions */}
          {event.isAuthor && (
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/events/${event.id}/edit`}
                className="inline-flex items-center gap-2 text-sm border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Pencil className="w-4 h-4" /> Редагувати
              </Link>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="inline-flex items-center gap-2 text-sm border border-red-200 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <Trash2 className="w-4 h-4" />
                {deleteLoading ? "Видалення…" : "Видалити"}
              </button>
            </div>
          )}

          {/* Invite link box */}
          {event.isAuthor && event.isPrivate && event.inviteToken && (
            <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
              <p className="text-sm font-medium text-indigo-800 mb-2">
                🔗 Посилання-запрошення
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white border border-indigo-200 rounded-lg px-3 py-2 text-gray-700 break-all select-all">
                  {`${typeof window !== "undefined" ? window.location.origin : ""}/events/${event.id}?invite=${event.inviteToken}`}
                </code>
                <button
                  onClick={copyInviteLink}
                  className="inline-flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-2 rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap shrink-0"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copied ? "Скопійовано!" : "Копіювати"}
                </button>
              </div>
            </div>
          )}

          {/* Comments */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Коментарі ({event.comments.length})
            </h2>

            {event.comments.length === 0 && (
              <p className="text-gray-400 text-sm mb-4">
                Поки що немає коментарів. Будьте першим!
              </p>
            )}

            <div className="space-y-3 mb-5">
              {event.comments.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-gray-200 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      {c.user.name}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(c.createdAt).toLocaleString("uk-UA")}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {c.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Comment form — only for logged-in users */}
            {!isGuest ? (
              <form onSubmit={handleComment} className="flex gap-2">
                <input
                  type="text"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Написати коментар…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={commentLoading || !comment.trim()}
                  className="inline-flex items-center gap-1.5 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <p className="text-sm text-gray-500">
                <Link href="/login" className="text-indigo-600 hover:underline">
                  Увійдіть
                </Link>
                , щоб залишити коментар
              </p>
            )}
          </section>
        </div>

        {/* ── Right sidebar ── */}
        <div className="space-y-4">
          {/* Info + registration card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4 shadow-sm">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Дата та час</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(event.startsAt)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Users className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Організатор</p>
                <p className="text-sm font-medium text-gray-900">
                  {event.author.name}
                </p>
              </div>
            </div>

            <div
              className={`text-sm font-medium px-3 py-2 rounded-lg text-center ${
                isFull
                  ? "bg-red-50 text-red-700"
                  : "bg-green-50 text-green-700"
              }`}
            >
              {isFull
                ? "Місць немає"
                : `Залишилось місць: ${spotsLeft} з ${event.capacity}`}
            </div>

            {regError && (
              <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                {regError}
              </div>
            )}

            {isPast ? (
              <div className="text-center text-sm text-gray-500 bg-gray-50 py-2.5 px-3 rounded-lg">
                Подія вже завершилась
              </div>
            ) : isGuest ? (
              <Link
                href="/login"
                className="block w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors text-center"
              >
                Увійдіть, щоб записатись
              </Link>
            ) : event.isRegistered ? (
              <button
                onClick={handleCancel}
                disabled={regLoading}
                className="w-full border border-red-300 text-red-600 py-2.5 rounded-lg text-sm font-medium hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {regLoading ? "Скасування…" : "Скасувати реєстрацію"}
              </button>
            ) : (
              <button
                onClick={handleRegister}
                disabled={regLoading || isFull}
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {regLoading ? "Реєстрація…" : isFull ? "Місць немає" : "Іду →"}
              </button>
            )}
          </div>

          {/* Attendees table — author only */}
          {event.isAuthor && event.attendees && event.attendees.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Учасники ({event.attendees.length})
              </h3>
              <div className="divide-y divide-gray-100">
                {event.attendees.map((a) => (
                  <div key={a.id} className="py-2 first:pt-0 last:pb-0">
                    <p className="text-sm font-medium text-gray-900">{a.name}</p>
                    <p className="text-xs text-gray-500">{a.email}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty attendees (author) */}
          {event.isAuthor && (!event.attendees || event.attendees.length === 0) && (
            <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center shadow-sm">
              <p className="text-sm text-gray-400">Поки що немає учасників</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page wrapper — provides Suspense boundary for useSearchParams ───────────────

export default function EventPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center py-24 text-gray-400 text-sm">
          Завантаження…
        </div>
      }
    >
      <EventPageContent />
    </Suspense>
  );
}
