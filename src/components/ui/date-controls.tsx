import { format } from "date-fns";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import ReactDatePicker, { CalendarContainer } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { NativeSelect } from "./native-select";
import {
  getBirthDateOpenToDate,
  getYearRange,
  getYearStart,
  parseIsoDate,
  sameDateValue,
  toIsoDate,
} from "../../lib/datePickerHelpers";
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

function parseMonthYear(month: string, months: string[], year: string) {
  if (!year.trim()) {
    return null;
  }

  const monthIndex = months.indexOf(month);
  const yearValue = Number(year);

  if (monthIndex < 0 || Number.isNaN(yearValue)) {
    return null;
  }

  return new Date(yearValue, monthIndex, 1);
}

function parseYear(value: string) {
  if (!value.trim()) {
    return null;
  }

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
  displayValue?: string;
  icon?: LucideIcon;
  placeholder?: string;
  value?: string;
};

const PickerTrigger = forwardRef<HTMLButtonElement, TriggerProps>(
  (
    {
      className,
      displayValue,
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
        "group flex h-14 w-full items-center justify-between gap-3 rounded-2xl border border-slate-300 bg-white px-4 text-left shadow-sm transition hover:border-slate-400 focus:border-[var(--cta-secondary)] focus:outline-none focus:ring-4 focus:ring-[var(--cta-secondary)]/10 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      type="button"
      {...props}
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-[var(--cta-secondary)]">
          <Icon className="h-4 w-4" />
        </span>
        <span
          className={cn(
            "truncate text-base font-medium",
            (displayValue ?? value) ? "text-slate-950" : "text-slate-500",
          )}
        >
          {(displayValue ?? value) || placeholder}
        </span>
      </span>
      <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-slate-600" />
    </button>
  ),
);

PickerTrigger.displayName = "PickerTrigger";

type DatePickerInstance = InstanceType<typeof ReactDatePicker>;
type CalendarContainerProps = React.ComponentProps<typeof CalendarContainer>;

function useResponsivePicker({
  committedDate,
  onCommit,
  withPortal,
}: {
  committedDate: Date | null;
  onCommit: (date: Date | null) => void;
  withPortal: boolean;
}) {
  const pickerRef = useRef<DatePickerInstance | null>(null);
  const [draftDate, setDraftDate] = useState<Date | null>(committedDate);
  const lastActionRef = useRef<"cancel" | "confirm" | null>(null);

  useEffect(() => {
    setDraftDate(committedDate);
  }, [committedDate]);

  const closePicker = () => pickerRef.current?.setOpen(false);

  const handleCancel = () => {
    lastActionRef.current = "cancel";
    setDraftDate(committedDate);
    closePicker();
  };

  const handleConfirm = () => {
    lastActionRef.current = "confirm";

    if (!sameDateValue(draftDate, committedDate)) {
      onCommit(draftDate);
    }

    closePicker();
  };

  const handleChange = (nextDate: Date | null) => {
    if (withPortal) {
      setDraftDate(nextDate);
      return;
    }

    onCommit(nextDate);
  };

  const handleCalendarOpen = () => {
    if (!withPortal) {
      return;
    }

    setDraftDate(committedDate);
  };

  const handleCalendarClose = () => {
    if (!withPortal) {
      return;
    }

    if (lastActionRef.current !== "confirm") {
      setDraftDate(committedDate);
    }

    lastActionRef.current = null;
  };

  const calendarContainer = withPortal
    ? ({ className, children, ...props }: CalendarContainerProps) => (
        <CalendarContainer className={className} {...props}>
          {children}
          <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-3">
            <div className="flex gap-3">
              <button
                className="flex-1 rounded-full border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                type="button"
                onClick={handleCancel}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-full bg-[#084E74] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#063a57]"
                type="button"
                onClick={handleConfirm}
              >
                Done
              </button>
            </div>
          </div>
        </CalendarContainer>
      )
    : undefined;

  return {
    activeDate: withPortal ? draftDate : committedDate,
    calendarContainer,
    handleCalendarClose,
    handleCalendarOpen,
    handleChange,
    handleClickOutside: withPortal ? handleCancel : undefined,
    pickerRef,
    shouldCloseOnSelect: !withPortal,
  };
}

function CalendarHeader({
  changeMonth,
  changeYear,
  date,
  decreaseMonth,
  decreaseYear,
  increaseMonth,
  increaseYear,
  maxYear,
  minYear = 1900,
  mode = "date",
  nextMonthButtonDisabled,
  nextYearButtonDisabled,
  prevMonthButtonDisabled,
  prevYearButtonDisabled,
}: {
  changeMonth: (month: number) => void;
  changeYear: (year: number) => void;
  date: Date;
  decreaseMonth: () => void;
  decreaseYear: () => void;
  increaseMonth: () => void;
  increaseYear: () => void;
  maxYear: number;
  minYear?: number;
  mode?: "date" | "month-year";
  nextMonthButtonDisabled: boolean;
  nextYearButtonDisabled: boolean;
  prevMonthButtonDisabled: boolean;
  prevYearButtonDisabled: boolean;
}) {
  const years = useMemo(() => getYearRange(maxYear, minYear), [maxYear, minYear]);
  const isMonthYearMode = mode === "month-year";
  const selectedYear = date.getFullYear();
  const isPreviousDisabled = isMonthYearMode
    ? prevYearButtonDisabled || selectedYear <= minYear
    : prevMonthButtonDisabled;
  const isNextDisabled = isMonthYearMode
    ? nextYearButtonDisabled || selectedYear >= maxYear
    : nextMonthButtonDisabled;

  return (
    <div className="flex items-center gap-2 px-4 pb-2 pt-4">
      <button
        aria-label={isMonthYearMode ? "Previous year" : "Previous month"}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={isPreviousDisabled}
        type="button"
        onClick={isMonthYearMode ? decreaseYear : decreaseMonth}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        className={cn(
          "grid flex-1 gap-2",
          !isMonthYearMode && "min-[480px]:grid-cols-[minmax(8.5rem,1fr)_7rem]",
        )}
      >
        {isMonthYearMode ? null : (
          <NativeSelect
            className="h-10 min-w-[8.5rem] rounded-xl px-3 py-2 text-sm"
            value={monthNames[date.getMonth()]}
            onChange={(event) => changeMonth(monthNames.indexOf(event.target.value))}
          >
            {monthNames.map((monthName) => (
              <option key={monthName} value={monthName}>
                {monthName}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect
          className="h-10 min-w-[7rem] rounded-xl px-3 py-2 text-sm"
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
        aria-label={isMonthYearMode ? "Next year" : "Next month"}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={isNextDisabled}
        type="button"
        onClick={isMonthYearMode ? increaseYear : increaseMonth}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ResponsiveDatePickerField({
  dateFormat,
  defaultOpenToDate,
  displayValue,
  id,
  maxDate,
  maxYear,
  pickerKey,
  placeholder,
  selectedDate,
  selectedFallbackDate,
  showMonthYearPicker,
  showYearPicker,
  yearItemNumber,
  onCommit,
}: {
  dateFormat: string;
  defaultOpenToDate: Date;
  displayValue: string;
  id?: string;
  maxDate?: Date;
  maxYear?: number;
  pickerKey: string;
  placeholder: string;
  selectedDate: Date | null;
  selectedFallbackDate?: Date;
  showMonthYearPicker?: boolean;
  showYearPicker?: boolean;
  yearItemNumber?: number;
  onCommit: (date: Date | null) => void;
}) {
  const withPortal = useDatePickerPortal();
  const {
    activeDate,
    calendarContainer,
    handleCalendarClose,
    handleCalendarOpen: handleResponsiveCalendarOpen,
    handleChange,
    handleClickOutside,
    pickerRef,
    shouldCloseOnSelect,
  } = useResponsivePicker({
    committedDate: selectedDate,
    onCommit,
    withPortal,
  });
  const handleCalendarOpen = () => {
    pickerRef.current?.setPreSelection(selectedDate ?? defaultOpenToDate);
    handleResponsiveCalendarOpen();
  };

  return (
    <ReactDatePicker
      key={`${pickerKey}-${withPortal ? "portal" : "desktop"}`}
      calendarClassName="app-datepicker-calendar"
      calendarContainer={calendarContainer}
      customInput={
        <PickerTrigger
          displayValue={displayValue}
          id={id}
          placeholder={placeholder}
        />
      }
      dateFormat={dateFormat}
      maxDate={maxDate}
      openToDate={selectedDate ?? defaultOpenToDate}
      placeholderText={placeholder}
      popperClassName="app-datepicker-popper"
      popperPlacement="bottom-start"
      renderCustomHeader={
        maxYear
          ? (props) => (
              <CalendarHeader
                {...props}
                maxYear={maxYear}
                mode={showMonthYearPicker ? "month-year" : "date"}
              />
            )
          : undefined
      }
      ref={pickerRef}
      selected={activeDate ?? selectedFallbackDate}
      shouldCloseOnSelect={shouldCloseOnSelect}
      showMonthYearPicker={showMonthYearPicker}
      showYearPicker={showYearPicker}
      withPortal={withPortal}
      yearItemNumber={yearItemNumber}
      onCalendarClose={handleCalendarClose}
      onCalendarOpen={handleCalendarOpen}
      onChange={handleChange}
      onClickOutside={handleClickOutside}
    />
  );
}

export function DatePickerField({
  id,
  maxDate,
  openToDate,
  onChange,
  placeholder = "DD / MM / YYYY",
  value,
}: {
  id: string;
  maxDate?: string;
  openToDate?: Date;
  onChange: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const selectedDate = useMemo(() => parseIsoDate(value), [value]);
  const maxSelectableDate = useMemo(
    () => (maxDate ? parseIsoDate(maxDate) : null),
    [maxDate],
  );
  const maxYear = maxSelectableDate?.getFullYear() ?? new Date().getFullYear();
  const defaultOpenToDate = useMemo(() => {
    if (openToDate) {
      return openToDate;
    }

    return getBirthDateOpenToDate(maxSelectableDate ?? new Date());
  }, [maxSelectableDate, openToDate]);
  const displayValue = useMemo(
    () => (selectedDate ? format(selectedDate, "dd MMMM yyyy") : ""),
    [selectedDate],
  );

  return (
    <ResponsiveDatePickerField
      dateFormat="dd/MM/yyyy"
      maxDate={maxSelectableDate ?? undefined}
      maxYear={maxYear}
      defaultOpenToDate={defaultOpenToDate}
      displayValue={displayValue}
      id={id}
      pickerKey="date"
      placeholder={placeholder}
      selectedDate={selectedDate}
      onCommit={(date) => onChange(date instanceof Date ? toIsoDate(date) : "")}
    />
  );
}

export function MonthYearPickerField({
  month,
  months,
  openToDate,
  onChange,
  placeholder = "Select month and year",
  year,
}: {
  description?: string;
  label: string;
  month: string;
  months: string[];
  openToDate?: Date;
  onChange: (month: string, year: string) => void;
  placeholder?: string;
  title: string;
  year: string;
  years: string[];
}) {
  const selectedDate = useMemo(
    () => parseMonthYear(month, months, year),
    [month, months, year],
  );
  const maxYear = new Date().getFullYear();
  const defaultOpenToDate = useMemo(
    () => openToDate ?? getYearStart(new Date()),
    [openToDate],
  );
  const displayValue = month && year ? `${month} ${year}` : "";

  return (
    <ResponsiveDatePickerField
      dateFormat="MMMM yyyy"
      defaultOpenToDate={defaultOpenToDate}
      displayValue={displayValue}
      maxYear={maxYear}
      pickerKey="month-year"
      placeholder={placeholder}
      selectedDate={selectedDate}
      showMonthYearPicker
      onCommit={(date) => {
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
  openToDate,
  onChange,
  placeholder = "Select year",
  value,
}: {
  description?: string;
  label: string;
  openToDate?: Date;
  onChange: (value: string) => void;
  placeholder?: string;
  title: string;
  value: string;
  years: string[];
}) {
  const selectedDate = useMemo(() => parseYear(value), [value]);
  const defaultOpenToDate = useMemo(
    () => openToDate ?? getYearStart(new Date()),
    [openToDate],
  );
  const displayValue = value;

  return (
    <ResponsiveDatePickerField
      dateFormat="yyyy"
      defaultOpenToDate={defaultOpenToDate}
      displayValue={displayValue}
      pickerKey="year"
      placeholder={placeholder}
      selectedDate={selectedDate}
      selectedFallbackDate={defaultOpenToDate}
      showYearPicker
      yearItemNumber={12}
      onCommit={(date) =>
        onChange(date instanceof Date ? String(date.getFullYear()) : "")
      }
    />
  );
}

export function formatIsoDateForDisplay(value: string) {
  const date = parseIsoDate(value);
  return date ? format(date, "dd MMMM yyyy") : value;
}
