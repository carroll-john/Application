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

      <div className="grid flex-1 gap-2 min-[480px]:grid-cols-[minmax(8.5rem,1fr)_7rem]">
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
  const withPortal = useDatePickerPortal();
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
    onCommit: (date) => onChange(date instanceof Date ? toIsoDate(date) : ""),
    withPortal,
  });
  const handleCalendarOpen = () => {
    pickerRef.current?.setPreSelection(selectedDate ?? defaultOpenToDate);
    handleResponsiveCalendarOpen();
  };

  return (
    <ReactDatePicker
      key={withPortal ? "date-portal" : "date-desktop"}
      calendarClassName="app-datepicker-calendar"
      calendarContainer={calendarContainer}
      customInput={<PickerTrigger displayValue={displayValue} id={id} />}
      dateFormat="dd/MM/yyyy"
      maxDate={maxSelectableDate ?? undefined}
      openToDate={selectedDate ?? defaultOpenToDate}
      placeholderText={placeholder}
      popperClassName="app-datepicker-popper"
      popperPlacement="bottom-start"
      renderCustomHeader={(props) => (
        <CalendarHeader {...props} maxYear={maxYear} />
      )}
      ref={pickerRef}
      selected={activeDate}
      shouldCloseOnSelect={shouldCloseOnSelect}
      withPortal={withPortal}
      onCalendarClose={handleCalendarClose}
      onCalendarOpen={handleCalendarOpen}
      onChange={handleChange}
      onClickOutside={handleClickOutside}
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
  const withPortal = useDatePickerPortal();
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
    onCommit: (date) => {
      if (date instanceof Date) {
        onChange(months[date.getMonth()], String(date.getFullYear()));
        return;
      }

      onChange("", "");
    },
    withPortal,
  });
  const handleCalendarOpen = () => {
    pickerRef.current?.setPreSelection(selectedDate ?? defaultOpenToDate);
    handleResponsiveCalendarOpen();
  };

  return (
    <ReactDatePicker
      key={withPortal ? "month-year-portal" : "month-year-desktop"}
      calendarClassName="app-datepicker-calendar"
      calendarContainer={calendarContainer}
      customInput={
        <PickerTrigger displayValue={displayValue} placeholder={placeholder} />
      }
      dateFormat="MMMM yyyy"
      openToDate={selectedDate ?? defaultOpenToDate}
      placeholderText={placeholder}
      popperClassName="app-datepicker-popper"
      popperPlacement="bottom-start"
      renderCustomHeader={(props) => (
        <CalendarHeader {...props} maxYear={maxYear} />
      )}
      ref={pickerRef}
      selected={activeDate}
      showMonthYearPicker
      shouldCloseOnSelect={shouldCloseOnSelect}
      withPortal={withPortal}
      onCalendarClose={handleCalendarClose}
      onCalendarOpen={handleCalendarOpen}
      onChange={handleChange}
      onClickOutside={handleClickOutside}
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
  const withPortal = useDatePickerPortal();
  const selectedDate = useMemo(() => parseYear(value), [value]);
  const defaultOpenToDate = useMemo(
    () => openToDate ?? getYearStart(new Date()),
    [openToDate],
  );
  const displayValue = value;
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
    onCommit: (date) => onChange(date instanceof Date ? String(date.getFullYear()) : ""),
    withPortal,
  });
  const handleCalendarOpen = () => {
    pickerRef.current?.setPreSelection(selectedDate ?? defaultOpenToDate);
    handleResponsiveCalendarOpen();
  };

  return (
    <ReactDatePicker
      key={withPortal ? "year-portal" : "year-desktop"}
      calendarClassName="app-datepicker-calendar"
      calendarContainer={calendarContainer}
      customInput={
        <PickerTrigger displayValue={displayValue} placeholder={placeholder} />
      }
      dateFormat="yyyy"
      openToDate={selectedDate ?? defaultOpenToDate}
      placeholderText={placeholder}
      popperClassName="app-datepicker-popper"
      popperPlacement="bottom-start"
      ref={pickerRef}
      selected={activeDate ?? defaultOpenToDate}
      showYearPicker
      shouldCloseOnSelect={shouldCloseOnSelect}
      withPortal={withPortal}
      yearItemNumber={12}
      onCalendarClose={handleCalendarClose}
      onCalendarOpen={handleCalendarOpen}
      onChange={handleChange}
      onClickOutside={handleClickOutside}
    />
  );
}

export function formatIsoDateForDisplay(value: string) {
  const date = parseIsoDate(value);
  return date ? format(date, "dd MMMM yyyy") : value;
}
