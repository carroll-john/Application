import { format } from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { NativeSelect } from "./native-select";
import { cn } from "../../lib/utils";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function toIsoDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function getYearRange(maxYear: number, minYear = 1900) {
  const years: string[] = [];

  for (let year = maxYear; year >= minYear; year -= 1) {
    years.push(String(year));
  }

  return years;
}

function parseMonthYear(month: string, months: string[], year: string) {
  const monthIndex = months.indexOf(month);
  const yearValue = Number(year);

  if (monthIndex < 0 || Number.isNaN(yearValue)) {
    return null;
  }

  return new Date(yearValue, monthIndex, 1);
}

function parseYear(value: string) {
  const year = Number(value);
  if (Number.isNaN(year)) {
    return null;
  }

  return new Date(year, 0, 1);
}

function useDatePickerPortal() {
  const [withPortal, setWithPortal] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(max-width: 640px)").matches
      : false,
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const updateMatches = (event?: MediaQueryListEvent) => {
      setWithPortal(event?.matches ?? mediaQuery.matches);
    };

    updateMatches();
    mediaQuery.addEventListener("change", updateMatches);

    return () => mediaQuery.removeEventListener("change", updateMatches);
  }, []);

  return withPortal;
}

type TriggerProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
  placeholder?: string;
  value?: string;
};

const PickerTrigger = forwardRef<HTMLButtonElement, TriggerProps>(
  (
    {
      className,
      icon: Icon = CalendarDays,
      placeholder = "Select date",
      value,
      ...props
    },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        "group flex h-14 w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 text-left shadow-sm transition hover:border-slate-400 focus:border-[#084E74] focus:outline-none focus:ring-4 focus:ring-[#084E74]/10 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      type="button"
      {...props}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[#084E74]">
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={cn(
            "truncate text-base font-medium",
            value ? "text-slate-950" : "text-slate-500",
          )}
        >
          {value || placeholder}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-600" />
    </button>
  ),
);

PickerTrigger.displayName = "PickerTrigger";

function CalendarHeader({
  changeMonth,
  changeYear,
  date,
  decreaseMonth,
  increaseMonth,
  maxYear,
  minYear = 1900,
  nextMonthButtonDisabled,
  prevMonthButtonDisabled,
}: {
  changeMonth: (month: number) => void;
  changeYear: (year: number) => void;
  date: Date;
  decreaseMonth: () => void;
  increaseMonth: () => void;
  maxYear: number;
  minYear?: number;
  nextMonthButtonDisabled: boolean;
  prevMonthButtonDisabled: boolean;
}) {
  const years = useMemo(() => getYearRange(maxYear, minYear), [maxYear, minYear]);

  return (
    <div className="flex items-center gap-2 px-4 pb-2 pt-4">
      <button
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={prevMonthButtonDisabled}
        type="button"
        onClick={decreaseMonth}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div className="grid flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
        <NativeSelect
          className="h-10 rounded-xl px-3 py-2 text-sm"
          value={monthNames[date.getMonth()]}
          onChange={(event) => changeMonth(monthNames.indexOf(event.target.value))}
        >
          {monthNames.map((monthName) => (
            <option key={monthName} value={monthName}>
              {monthName}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          className="h-10 rounded-xl px-3 py-2 text-sm"
          value={String(date.getFullYear())}
          onChange={(event) => changeYear(Number(event.target.value))}
        >
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </NativeSelect>
      </div>

      <button
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={nextMonthButtonDisabled}
        type="button"
        onClick={increaseMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

export function DatePickerField({
  id,
  maxDate,
  onChange,
  placeholder = "DD / MM / YYYY",
  value,
}: {
  id: string;
  maxDate?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const withPortal = useDatePickerPortal();
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const maxSelectableDate = useMemo(
    () => (maxDate ? parseIsoDate(maxDate) : null),
    [maxDate],
  );
  const maxYear = maxSelectableDate?.getFullYear() ?? new Date().getFullYear();

  return (
    <DatePicker
      calendarClassName="app-datepicker-calendar"
      customInput={<PickerTrigger id={id} />}
      dateFormat="dd/MM/yyyy"
      maxDate={maxSelectableDate ?? undefined}
      placeholderText={placeholder}
      popperClassName="app-datepicker-popper"
      popperPlacement="bottom-start"
      renderCustomHeader={(props) => (
        <CalendarHeader {...props} maxYear={maxYear} />
      )}
      selected={selectedDate}
      withPortal={withPortal}
      onChange={(date: Date | null) =>
        onChange(date instanceof Date ? toIsoDate(date) : "")
      }
    />
  );
}

export function MonthYearPickerField({
  month,
  months,
  onChange,
  placeholder = "Select month and year",
  year,
}: {
  description?: string;
  label: string;
  month: string;
  months: string[];
  onChange: (month: string, year: string) => void;
  placeholder?: string;
  title: string;
  year: string;
  years: string[];
}) {
  const withPortal = useDatePickerPortal();
  const selectedDate = useMemo(
    () => parseMonthYear(month, months, year),
    [month, months, year],
  );
  const maxYear = Number(year || new Date().getFullYear());

  return (
    <DatePicker
      calendarClassName="app-datepicker-calendar"
      customInput={<PickerTrigger placeholder={placeholder} />}
      dateFormat="MMMM yyyy"
      placeholderText={placeholder}
      popperClassName="app-datepicker-popper"
      popperPlacement="bottom-start"
      renderCustomHeader={(props) => (
        <CalendarHeader {...props} maxYear={maxYear} />
      )}
      selected={selectedDate}
      showMonthYearPicker
      withPortal={withPortal}
      onChange={(date: Date | null) => {
        if (date instanceof Date) {
          onChange(months[date.getMonth()], String(date.getFullYear()));
          return;
        }

        onChange("", "");
      }}
    />
  );
}

export function YearPickerField({
  onChange,
  placeholder = "Select year",
  value,
}: {
  description?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title: string;
  value: string;
  years: string[];
}) {
  const withPortal = useDatePickerPortal();
  const selectedDate = useMemo(() => parseYear(value), [value]);

  return (
    <DatePicker
      calendarClassName="app-datepicker-calendar"
      customInput={<PickerTrigger placeholder={placeholder} />}
      dateFormat="yyyy"
      placeholderText={placeholder}
      popperClassName="app-datepicker-popper"
      popperPlacement="bottom-start"
      selected={selectedDate}
      showYearPicker
      withPortal={withPortal}
      yearItemNumber={12}
      onChange={(date: Date | null) =>
        onChange(date instanceof Date ? String(date.getFullYear()) : "")
      }
    />
  );
}

export function formatIsoDateForDisplay(value: string) {
  const date = parseIsoDate(value);
  return date ? format(date, "dd MMMM yyyy") : value;
}
