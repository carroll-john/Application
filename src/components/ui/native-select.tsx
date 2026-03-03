import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

type NativeSelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

type SelectOption = {
  disabled: boolean;
  label: string;
  value: string;
};

function getTextContent(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  return React.Children.toArray(node).map(getTextContent).join("");
}

export const NativeSelect = React.forwardRef<HTMLButtonElement, NativeSelectProps>(
  (
    {
      children,
      className,
      disabled,
      id,
      name,
      onChange,
      required,
      value,
    },
    ref,
  ) => {
    const rootRef = React.useRef<HTMLDivElement>(null);
    const listRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const internalId = React.useId();
    const selectId = id ?? `select-${internalId}`;
    const listboxId = `${selectId}-listbox`;
    const [isOpen, setIsOpen] = React.useState(false);
    const [openDirection, setOpenDirection] = React.useState<"down" | "up">("down");
    const [maxListHeight, setMaxListHeight] = React.useState(320);

    const options = React.useMemo(() => {
      return React.Children.toArray(children).flatMap((child) => {
        if (!React.isValidElement(child) || child.type !== "option") {
          return [];
        }

        const option = child as React.ReactElement<
          React.OptionHTMLAttributes<HTMLOptionElement>
        >;

        return [
          {
            disabled: Boolean(option.props.disabled),
            label: getTextContent(option.props.children),
            value: String(option.props.value ?? ""),
          } satisfies SelectOption,
        ];
      });
    }, [children]);

    const stringValue = typeof value === "string" ? value : "";
    const placeholderLabel =
      options.find((option) => option.value === "")?.label ?? "Select option";
    const selectedOption = options.find((option) => option.value === stringValue);
    const displayLabel = selectedOption?.label || placeholderLabel;
    const hasSelection = stringValue !== "";

    React.useImperativeHandle(ref, () => buttonRef.current as HTMLButtonElement, []);

    React.useEffect(() => {
      if (!isOpen) {
        return;
      }

      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node;

        if (!rootRef.current?.contains(target)) {
          setIsOpen(false);
        }
      };

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      };

      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("keydown", handleEscape);

      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [isOpen]);

    React.useEffect(() => {
      if (!isOpen) {
        return;
      }

      const updatePlacement = () => {
        const triggerRect = buttonRef.current?.getBoundingClientRect();

        if (!triggerRect) {
          return;
        }

        const viewportPadding = 16;
        const preferredHeight = 320;
        const spaceBelow = window.innerHeight - triggerRect.bottom - viewportPadding;
        const spaceAbove = triggerRect.top - viewportPadding;
        const shouldOpenUp = spaceBelow < 240 && spaceAbove > spaceBelow;
        const availableSpace = shouldOpenUp ? spaceAbove : spaceBelow;

        setOpenDirection(shouldOpenUp ? "up" : "down");
        setMaxListHeight(Math.max(160, Math.min(preferredHeight, availableSpace)));
      };

      updatePlacement();
      window.addEventListener("resize", updatePlacement);
      window.addEventListener("scroll", updatePlacement, true);

      return () => {
        window.removeEventListener("resize", updatePlacement);
        window.removeEventListener("scroll", updatePlacement, true);
      };
    }, [isOpen]);

    React.useEffect(() => {
      if (!isOpen) {
        return;
      }

      const selectedButton =
        listRef.current?.querySelector<HTMLButtonElement>(
          `[data-value="${CSS.escape(stringValue)}"]`,
        ) ?? listRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");

      selectedButton?.focus();
    }, [isOpen, stringValue]);

    const emitChange = React.useCallback(
      (nextValue: string) => {
        if (!onChange) {
          return;
        }

        onChange({
          target: {
            id: selectId,
            name,
            value: nextValue,
          },
        } as React.ChangeEvent<HTMLSelectElement>);
      },
      [name, onChange, selectId],
    );

    const handleSelect = React.useCallback(
      (nextValue: string) => {
        emitChange(nextValue);
        setIsOpen(false);
        buttonRef.current?.focus();
      },
      [emitChange],
    );

    const optionsList = (
      <div
        ref={listRef}
        aria-labelledby={selectId}
        className={cn(
          "overflow-y-auto bg-white p-2 shadow-[0_22px_48px_rgba(15,23,42,0.16)]",
          openDirection === "down"
            ? "rounded-b-[24px] border border-slate-300 border-t-0"
            : "rounded-t-[24px] border border-slate-300 border-b-0",
        )}
        id={listboxId}
        role="listbox"
        style={{ maxHeight: maxListHeight }}
      >
        {options.map((option) => {
          const isSelected = option.value === stringValue;
          const isPlaceholderOption = option.value === "";

          return (
            <button
              key={`${option.value}-${option.label}`}
              aria-selected={isSelected}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-base transition",
                option.disabled
                  ? "cursor-not-allowed text-slate-300"
                  : "hover:bg-slate-50 focus:bg-slate-50 focus:outline-none",
                isSelected
                  ? "bg-[#EAF4FB] font-semibold text-[#084E74]"
                  : isPlaceholderOption
                    ? "text-slate-500"
                    : "text-slate-900",
              )}
              data-value={option.value}
              disabled={option.disabled}
              role="option"
              type="button"
              onClick={() => handleSelect(option.value)}
            >
              <span className="min-w-0 flex-1 break-normal">{option.label}</span>
              {isSelected ? <Check className="h-4 w-4 shrink-0" /> : null}
            </button>
          );
        })}
      </div>
    );

    return (
      <div ref={rootRef} className="relative">
        <select
          aria-hidden="true"
          className="pointer-events-none absolute h-0 w-0 opacity-0"
          name={name}
          required={required}
          tabIndex={-1}
          value={stringValue}
          onChange={onChange}
        >
          {children}
        </select>
        <button
          ref={buttonRef}
          aria-controls={listboxId}
          aria-expanded={isOpen}
          className={cn(
            "flex h-14 w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left text-base shadow-sm outline-none transition hover:border-slate-400 focus:border-[#084E74] focus:ring-4 focus:ring-[#084E74]/10 disabled:cursor-not-allowed disabled:opacity-60",
            isOpen && openDirection === "down" && "rounded-b-none border-b-transparent",
            isOpen && openDirection === "up" && "rounded-t-none border-t-transparent",
            className,
          )}
          disabled={disabled}
          id={selectId}
          role="combobox"
          type="button"
          onClick={() => {
            if (disabled) {
              return;
            }

            setIsOpen((previous) => !previous);
          }}
          onKeyDown={(event) => {
            if (disabled) {
              return;
            }

            if (
              event.key === "ArrowDown" ||
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              setIsOpen(true);
            }
          }}
        >
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              hasSelection ? "text-slate-900" : "text-slate-500",
            )}
          >
            {displayLabel}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-slate-400 transition",
              isOpen ? "rotate-180 text-slate-600" : "text-slate-400",
            )}
          />
        </button>

        {isOpen ? (
          <div
            className={cn(
              "absolute left-0 right-0 z-50",
              openDirection === "down"
                ? "top-[calc(100%-1px)]"
                : "bottom-[calc(100%-1px)]",
            )}
          >
            {optionsList}
          </div>
        ) : null}
      </div>
    );
  },
);

NativeSelect.displayName = "NativeSelect";
