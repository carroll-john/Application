import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

export interface AutocompleteSuggestion {
  id: string;
  label: string;
  value: string;
  detail?: string;
  matchText?: string;
}

type AutocompleteInputProps<TSuggestion extends AutocompleteSuggestion> = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value"
> & {
  value: string;
  onValueChange: (value: string) => void;
  suggestions?: TSuggestion[];
  searchSuggestions?: (query: string) => Promise<TSuggestion[]>;
  minimumQueryLength?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  onSuggestionSelect?: (suggestion: TSuggestion) => void | Promise<void>;
  suggestionIcon?: ReactNode;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getMatchingSuggestions<TSuggestion extends AutocompleteSuggestion>(
  query: string,
  suggestions: TSuggestion[],
) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return suggestions.slice(0, 8);
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
    .slice(0, 8)
    .map((item) => item.suggestion);
}

export function AutocompleteInput<TSuggestion extends AutocompleteSuggestion>({
  value,
  onValueChange,
  suggestions = [],
  searchSuggestions,
  minimumQueryLength = 3,
  emptyMessage = "No matches found. Keep typing to enter manually.",
  loadingMessage = "Searching...",
  onSuggestionSelect,
  suggestionIcon,
  className,
  id,
  onBlur,
  onFocus,
  onKeyDown,
  ...props
}: AutocompleteInputProps<TSuggestion>) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listboxId = `${inputId}-suggestions`;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [remoteSuggestions, setRemoteSuggestions] = useState<TSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const requestRef = useRef(0);

  const localMatches = useMemo(
    () => getMatchingSuggestions(value, suggestions),
    [suggestions, value],
  );

  useEffect(() => {
    if (!searchSuggestions) {
      setRemoteSuggestions([]);
      setIsLoading(false);
      setLookupError(null);
      return;
    }

    if (!isOpen) {
      return;
    }

    const query = value.trim();

    if (query.length < minimumQueryLength) {
      setRemoteSuggestions([]);
      setIsLoading(false);
      setLookupError(null);
      setActiveIndex(-1);
      return;
    }

    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    setIsLoading(true);
    setLookupError(null);

    const timer = window.setTimeout(() => {
      void searchSuggestions(query)
        .then((results) => {
          if (requestRef.current === requestId) {
            setRemoteSuggestions(results);
            setActiveIndex(-1);
          }
        })
        .catch(() => {
          if (requestRef.current === requestId) {
            setRemoteSuggestions([]);
            setLookupError("Suggestions are unavailable. You can keep typing manually.");
          }
        })
        .finally(() => {
          if (requestRef.current === requestId) {
            setIsLoading(false);
          }
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [isOpen, minimumQueryLength, searchSuggestions, value]);

  const matches = useMemo(
    () => (searchSuggestions ? remoteSuggestions : localMatches),
    [localMatches, remoteSuggestions, searchSuggestions],
  );

  const hasSuggestions = matches.length > 0;
  const queryTooShort = Boolean(searchSuggestions) && value.trim().length < minimumQueryLength;
  const showSuggestions =
    isOpen &&
    (hasSuggestions ||
      isLoading ||
      queryTooShort ||
      Boolean(lookupError) ||
      value.trim().length > 0);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    setActiveIndex((previous) => {
      if (!hasSuggestions) {
        return -1;
      }

      return Math.min(previous, matches.length - 1);
    });
  }, [hasSuggestions, matches.length]);

  const commitSelection = (selection: TSuggestion) => {
    onValueChange(selection.value);
    setIsOpen(false);
    setActiveIndex(-1);
    void onSuggestionSelect?.(selection);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);

    if (event.defaultPrevented) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((previous) =>
        hasSuggestions ? Math.min(previous + 1, matches.length - 1) : -1,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setActiveIndex((previous) => Math.max(previous - 1, 0));
      return;
    }

    if (event.key === "Enter" && isOpen && activeIndex >= 0 && matches[activeIndex]) {
      event.preventDefault();
      commitSelection(matches[activeIndex]);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        {...props}
        id={inputId}
        aria-activedescendant={
          activeIndex >= 0 ? `${inputId}-option-${activeIndex}` : undefined
        }
        aria-autocomplete="list"
        aria-controls={showSuggestions ? listboxId : undefined}
        aria-expanded={showSuggestions}
        className={className}
        role="combobox"
        value={value}
        onBlur={(event) => {
          onBlur?.(event);
        }}
        onChange={(event) => {
          onValueChange(event.target.value);
          setIsOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={(event) => {
          onFocus?.(event);
          setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {showSuggestions ? (
        <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
          {hasSuggestions ? (
            <ul id={listboxId} role="listbox" className="max-h-72 overflow-y-auto py-2">
              {matches.map((suggestion, index) => (
                <li key={suggestion.id} id={`${inputId}-option-${index}`} role="option">
                  <button
                    className={cn(
                      "flex w-full items-start gap-3 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50",
                      index === activeIndex && "bg-slate-50 text-slate-900",
                    )}
                    type="button"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      commitSelection(suggestion);
                    }}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    {suggestionIcon ? (
                      <span className="mt-0.5 shrink-0 text-[#084E74]">
                        {suggestionIcon}
                      </span>
                    ) : null}
                    <span className="flex min-w-0 flex-col">
                      <span>{suggestion.label}</span>
                      {suggestion.detail ? (
                        <span className="text-xs text-slate-500">{suggestion.detail}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : isLoading ? (
            <div className="px-4 py-3 text-sm text-slate-500">{loadingMessage}</div>
          ) : queryTooShort ? (
            <div className="px-4 py-3 text-sm text-slate-500">
              Start typing at least {minimumQueryLength} characters to search.
            </div>
          ) : lookupError ? (
            <div className="px-4 py-3 text-sm text-slate-500">{lookupError}</div>
          ) : (
            <div className="px-4 py-3 text-sm text-slate-500">{emptyMessage}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
