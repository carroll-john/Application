import type { RawValueItem } from "./types";

/** Shared text-normalization helpers used across the course-catalog normalizer. */

export function sanitizeText(value?: string | null) {
  return value?.trim() || "";
}

export function getFirstSentence(value: string, maxLength = 200) {
  if (!value) {
    return "";
  }

  const normalized = value.replace(/\s+/g, " ").trim();
  const sentenceMatch = normalized.match(/^.*?[.!?](?=\s|$)/);
  const candidate = sentenceMatch?.[0]?.trim() || normalized;

  if (candidate.length <= maxLength) {
    return candidate;
  }

  return `${candidate.slice(0, maxLength - 1).trim()}…`;
}

export function findSentence(value: string, pattern: RegExp) {
  if (!value) {
    return "";
  }

  const sentences = value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  return sentences.find((sentence) => pattern.test(sentence)) ?? "";
}

export function toValueList(items?: RawValueItem[] | null) {
  return (items ?? [])
    .map((item) => sanitizeText(item.value))
    .filter(Boolean);
}
