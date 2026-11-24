import { z } from "zod";

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Ім'я має містити щонайменше 2 символи")
    .max(50, "Ім'я не може перевищувати 50 символів"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Введіть коректний email"),
  password: z
    .string()
    .min(8, "Пароль має містити щонайменше 8 символів")
    .max(100, "Пароль не може перевищувати 100 символів"),
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Введіть коректний email"),
  password: z.string().min(1, "Введіть пароль"),
});

// ── Shared ────────────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid();

const coverUrlSchema = z.string().refine(
  (val) =>
    /^\/api\/uploads\/[0-9a-f-]+\.(jpg|png|webp)$/.test(val) ||
    val === "/default-cover.svg",
  "Невірний URL обкладинки"
);

const futureDateSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), "Невірний формат дати")
  .refine(
    (val) => new Date(val) > new Date(),
    "Дата події має бути в майбутньому"
  );

// ── Event schemas ─────────────────────────────────────────────────────────────

export const createEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Назва має містити щонайменше 3 символи")
    .max(120, "Назва не може перевищувати 120 символів"),
  description: z
    .string()
    .trim()
    .min(1, "Опис не може бути порожнім")
    .max(5000, "Опис не може перевищувати 5000 символів"),
  startsAt: futureDateSchema,
  capacity: z
    .number()
    .int("Кількість місць має бути цілим числом")
    .min(1, "Кількість місць має бути щонайменше 1")
    .max(10000, "Кількість місць не може перевищувати 10000"),
  coverUrl: coverUrlSchema,
  isPrivate: z.boolean().default(false),
});

// Partial version: all fields optional, startsAt still validated when present
export const updateEventSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Назва має містити щонайменше 3 символи")
    .max(120, "Назва не може перевищувати 120 символів")
    .optional(),
  description: z
    .string()
    .trim()
    .min(1, "Опис не може бути порожнім")
    .max(5000, "Опис не може перевищувати 5000 символів")
    .optional(),
  startsAt: futureDateSchema.optional(),
  capacity: z
    .number()
    .int("Кількість місць має бути цілим числом")
    .min(1, "Кількість місць має бути щонайменше 1")
    .max(10000, "Кількість місць не може перевищувати 10000")
    .optional(),
  coverUrl: coverUrlSchema.optional(),
  isPrivate: z.boolean().optional(),
});
