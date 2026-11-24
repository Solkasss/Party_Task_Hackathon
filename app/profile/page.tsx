"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Calendar, Users, Lock, Copy } from "lucide-react";

type EventItem = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
  coverUrl: string;
  isPrivate: boolean;
  inviteToken?: string | null;
  author?: { id: string; name: string };
  _count: { attendances: number };
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleString("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyButton({ token, eventId }: { token: string; eventId: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const url = `${window.location.origin}/events/${eventId}?invite=${token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 border border-indigo-200 hover:border-indigo-400 px-2 py-1 rounded-md transition-colors"
    >
      <Copy className="w-3 h-3" />
      {copied ? "Скопійовано!" : "Копіювати посилання"}
    </button>
  );
}

function EventCard({
  event,
  showInvite = false,
}: {
  event: EventItem;
  showInvite?: boolean;
}) {
  const spotsLeft = event.capacity - event._count.attendances;

  return (
    <Link
      href={`/events/${event.id}`}
      className="group flex gap-4 bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-indigo-50">
        <Image
          src={event.coverUrl || "/default-cover.svg"}
          alt={event.title}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <h3 className="text-sm font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
            {event.title}
          </h3>
          {event.isPrivate && (
            <span className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full shrink-0">
              <Lock className="w-2.5 h-2.5" /> Приватна
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500 mb-0.5">
          <Calendar className="w-3 h-3 text-indigo-400 shrink-0" />
          {formatDate(event.startsAt)}
        </div>

        <div className="flex items-center gap-1 text-xs text-gray-500 mb-2">
          <Users className="w-3 h-3 text-indigo-400 shrink-0" />
          {spotsLeft > 0
            ? `Залишилось місць: ${spotsLeft} з ${event.capacity}`
            : "Місць немає"}
        </div>

        {showInvite && event.isPrivate && event.inviteToken && (
          /* Prevent the Link click from triggering when copying */
          <div onClick={(e) => e.preventDefault()}>
            <CopyButton token={event.inviteToken} eventId={event.id} />
          </div>
        )}
      </div>
    </Link>
  );
}

export default function ProfilePage() {
  const [tab, setTab] = useState<"created" | "registered">("created");
  const [createdEvents, setCreatedEvents] = useState<EventItem[]>([]);
  const [registeredEvents, setRegisteredEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [user, setUser] = useState<{ name: string; email: string } | null>(
    null
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/profile").then((r) => r.json()),
    ])
      .then(([meData, profileData]) => {
        if (meData.user) setUser(meData.user);
        if (profileData.error) {
          setError(profileData.error);
          return;
        }
        setCreatedEvents(profileData.createdEvents ?? []);
        setRegisteredEvents(profileData.registeredEvents ?? []);
      })
      .catch(() => setError("Помилка завантаження профілю"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="text-center py-24 text-gray-400 text-sm">
        Завантаження…
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Link href="/login" className="text-indigo-600 hover:underline text-sm">
          Увійти
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Profile header */}
      {user && (
        <div className="mb-8 pb-6 border-b border-gray-200">
          <div className="w-14 h-14 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xl font-bold mb-3 select-none">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{user.name}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setTab("created")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "created"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Створені мною ({createdEvents.length})
        </button>
        <button
          onClick={() => setTab("registered")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === "registered"
              ? "border-indigo-600 text-indigo-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Я йду ({registeredEvents.length})
        </button>
      </div>

      {/* Created events */}
      {tab === "created" && (
        <div>
          {createdEvents.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-5">
                Ви ще не створили жодної події
              </p>
              <Link
                href="/events/new"
                className="inline-flex bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Створити подію
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {createdEvents.map((e) => (
                <EventCard key={e.id} event={e} showInvite />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Registered events */}
      {tab === "registered" && (
        <div>
          {registeredEvents.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 mb-5">
                Ви ще не зареєструвалися на жодну подію
              </p>
              <Link
                href="/"
                className="inline-flex bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Знайти події
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {registeredEvents.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
