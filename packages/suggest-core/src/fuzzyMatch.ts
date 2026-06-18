import type { AutocompleteSuggestion } from "./types";

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getMatchingSuggestions<TSuggestion extends AutocompleteSuggestion>(
  query: string,
  suggestions: TSuggestion[],
  limit = 8,
) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return suggestions.slice(0, limit);
  }

  const queryTerms = normalizedQuery.split(/\s+/);

  return suggestions
    .map((suggestion) => {
      const normalizedSuggestion = normalize(
        suggestion.matchText ?? `${suggestion.label} ${suggestion.value}`,
      );
      const startsWithQuery = normalizedSuggestion.startsWith(normalizedQuery);
      const matchesAllTerms = queryTerms.every((term) =>
        normalizedSuggestion.includes(term),
      );

      if (!matchesAllTerms) {
        return null;
      }

      return {
        score: startsWithQuery ? 0 : normalizedSuggestion.indexOf(normalizedQuery) + 1,
        suggestion,
      };
    })
    .filter(
      (item): item is { score: number; suggestion: TSuggestion } => item !== null,
    )
    .sort((left, right) => left.score - right.score)
    .slice(0, limit)
    .map((item) => item.suggestion);
}
