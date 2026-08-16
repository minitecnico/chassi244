import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Junta classes do Tailwind resolvendo conflitos (a última vence). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
