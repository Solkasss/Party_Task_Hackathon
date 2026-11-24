"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Calendar, Users } from "lucide-react";

type EventSummary = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
  coverUrl: string;
  isPrivate: boolean;
  author: { id: string; name: string };
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

export default function HomePage() {
  const [q, setQ] = useState("");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const qs = query ? `?q=${encodeURIComponent(query)}` : "";
      const res = await fetch(`/api/events${qs}`);
      const data = await res.json();
      setEvents(data.events ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => fetchEvents(q), 300);
    return () => clearTimeout(timer);
  }, [q, fetchEvents]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Найближчі події
        </h1>
        <p className="text-gray-500 text-lg">
          Знайдіть подію, яка вам до душі
        </p>
      </div>

      {/* Search bar */}
      <div className="relative max-w-xl mx-auto mb-10">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Пошук за назвою…"
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm shadow-sm"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-24 text-gray-400 text-sm">
          Завантаження…
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && (
        <div className="text-center py-24">
          <p className="text-gray-400 text-lg">
            {q
              ? `За запитом «${q}» подій не знайдено`
              : "Поки що немає жодної публічної події"}
          </p>
          <Link
            href="/events/new"
            className="mt-4 inline-flex bg-indigo-600 text-white text-sm px-5 py-2.5 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Створити першу подію
          </Link>
        </div>
      )}

      {/* Event grid */}
      {!loading && events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const spotsLeft = event.capacity - event._count.attendances;
            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                {/* Cover */}
                <div className="relative h-44 bg-indigo-100">
                  <Image
                    src={event.coverUrl || "/default-cover.svg"}
                    alt={event.title}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </div>

                {/* Body */}
                <div className="p-5">
                  <h2 className="font-semibold text-gray-900 text-base leading-snug mb-1 group-hover:text-indigo-600 transition-colors line-clamp-2">
                    {event.title}
                  </h2>
                  <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                    {event.description}
                  </p>

                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-1">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {formatDate(event.startsAt)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                    <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    {event.author.name}
                  </div>

                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                      spotsLeft > 0
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700"
                    }`}
                  >
                    {spotsLeft > 0
                      ? `Залишилось місць: ${spotsLeft} з ${event.capacity}`
                      : "Місць немає"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
