"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calendar, Users, Search, X, Plus } from "lucide-react";

type PublicEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
  coverUrl: string;
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
  const [events, setEvents] = useState<PublicEvent[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadEvents = useCallback(async (search: string) => {
    setLoading(true);
    setError("");
    try {
      const url = search.trim()
        ? `/api/events?q=${encodeURIComponent(search.trim())}`
        : "/api/events";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Не вдалося завантажити події");
        return;
      }
      setEvents(data.events ?? []);
    } catch {
      setError("Помилка з'єднання із сервером");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadEvents(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, loadEvents]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header & Search */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Найближчі події</h1>
          <p className="text-sm text-gray-500 mt-1">
            Знаходь цікаві зустрічі та бронюй місце за секунду
          </p>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Пошук подій за назвою…"
            className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-9 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистити пошук"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 mb-6 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-80 bg-white border border-gray-200 rounded-2xl animate-pulse"
            />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl px-4">
          <p className="text-gray-500 text-base mb-4">
            {query.trim()
              ? `За запитом «${query.trim()}» подій не знайдено`
              : "Поки що немає запланованих публічних подій"}
          </p>
          {query.trim() ? (
            <button
              onClick={() => setQuery("")}
              className="inline-flex items-center gap-1.5 text-sm text-indigo-600 font-medium hover:underline"
            >
              Скинути пошук
            </button>
          ) : (
            <Link
              href="/events/new"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Створити подію
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => {
            const taken = event._count?.attendances ?? 0;
            const spotsLeft = Math.max(0, event.capacity - taken);
            const isFull = spotsLeft === 0;

            return (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col"
              >
                <div className="relative h-48 w-full bg-indigo-50 overflow-hidden">
                  <Image
                    src={event.coverUrl || "/default-cover.svg"}
                    alt={event.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                  <span
                    className={`absolute top-3 right-3 text-xs font-medium px-2.5 py-1 rounded-full backdrop-blur-sm ${
                      isFull
                        ? "bg-red-600/90 text-white"
                        : "bg-white/90 text-gray-800"
                    }`}
                  >
                    {isFull
                      ? "Місць немає"
                      : `Залишилось: ${spotsLeft} з ${event.capacity}`}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col">
                  <h2 className="text-lg font-bold text-gray-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-1.5">
                    {event.title}
                  </h2>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-4 flex-1">
                    {event.description}
                  </p>

                  <div className="space-y-1.5 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span>{formatDate(event.startsAt)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                        <span>Організатор: {event.author.name}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
