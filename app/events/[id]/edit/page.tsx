"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { Upload } from "lucide-react";

type EventData = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  capacity: number;
  coverUrl: string;
  isPrivate: boolean;
  isAuthor: boolean;
};

function toLocalDatetimeStr(isoStr: string) {
  const d = new Date(isoStr);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;

  const [form, setForm] = useState({
    title: "",
    description: "",
    startsAt: "",
    capacity: 10,
    coverUrl: "/default-cover.svg",
    isPrivate: false,
  });
  const [preview, setPreview] = useState("/default-cover.svg");
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/events/${id}`)
      .then((res) => res.json())
      .then((data) => {
        const event: EventData = data.event;
        if (!event?.isAuthor) {
          router.replace(`/events/${id}`);
          return;
        }
        setForm({
          title: event.title,
          description: event.description,
          startsAt: toLocalDatetimeStr(event.startsAt),
          capacity: event.capacity,
          coverUrl: event.coverUrl,
          isPrivate: event.isPrivate,
        });
        setPreview(event.coverUrl);
      })
      .catch(() => setError("Помилка завантаження події"))
      .finally(() => setFetchLoading(false));
  }, [id, router]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Помилка завантаження");
        return;
      }
      setForm((f) => ({ ...f, coverUrl: data.url }));
      setPreview(data.url);
    } catch {
      setError("Помилка завантаження файлу");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/events/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
          capacity: Number(form.capacity),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Помилка збереження");
        return;
      }
      router.push(`/events/${id}`);
    } catch {
      setError("Помилка з'єднання");
    } finally {
      setLoading(false);
    }
  }

  if (fetchLoading) {
    return (
      <div className="text-center py-24 text-gray-400 text-sm">
        Завантаження…
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Редагувати подію
      </h1>

      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="space-y-5 bg-white rounded-2xl border border-gray-200 shadow-sm p-6"
      >
        {/* Cover */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Обкладинка
          </label>
          <div className="relative h-48 w-full rounded-xl overflow-hidden bg-indigo-50 mb-3">
            <Image
              src={preview}
              alt="Обкладинка"
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 border border-indigo-300 hover:border-indigo-500 px-3 py-1.5 rounded-lg transition-colors">
            <Upload className="w-4 h-4" />
            {uploading ? "Завантаження…" : "Змінити зображення"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
              disabled={uploading}
            />
          </label>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Назва події
          </label>
          <input
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Опис
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={4}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            required
          />
        </div>

        {/* Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Дата та час початку
          </label>
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Capacity */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Кількість місць
          </label>
          <input
            type="number"
            value={form.capacity}
            onChange={(e) =>
              setForm({ ...form, capacity: Number(e.target.value) })
            }
            min={1}
            max={10000}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            required
          />
        </div>

        {/* Private toggle */}
        <div className="flex items-center gap-3">
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={form.isPrivate}
              onChange={(e) =>
                setForm({ ...form, isPrivate: e.target.checked })
              }
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600" />
          </label>
          <span className="text-sm text-gray-700">Приватна подія</span>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Скасувати
          </button>
          <button
            type="submit"
            disabled={loading || uploading}
            className="flex-1 bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? "Збереження…" : "Зберегти зміни"}
          </button>
        </div>
      </form>
    </div>
  );
}
