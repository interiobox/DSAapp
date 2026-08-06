import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return DateTimeFormat.format(new Date(dateStr));
}

const DateTimeFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return DateTimeFormat.format(new Date(dateStr));
}
