type DevConsoleLevel = "debug" | "error" | "info" | "log" | "warn";

interface DevConsoleEntry {
  args: string[];
  level: DevConsoleLevel;
  message: string;
  source?: string;
  timestamp: string;
  url: string;
}

let isInstalled = false;

function serializeConsoleArg(value: unknown): string {
  if (value instanceof Error) {
    return value.stack ?? `${value.name}: ${value.message}`;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function publishDevConsoleEntry(entry: DevConsoleEntry) {
  void fetch("/__dev/console", {
    body: JSON.stringify(entry),
    headers: {
      "Content-Type": "application/json",
    },
    keepalive: true,
    method: "POST",
  }).catch(() => {
    // Dev-only bridge; ignore transport failures.
  });
}

function mirrorConsoleCall(
  level: DevConsoleLevel,
  original: (...args: unknown[]) => void,
  args: unknown[],
) {
  original(...args);

  publishDevConsoleEntry({
    args: args.map(serializeConsoleArg),
    level,
    message: args.map(serializeConsoleArg).join(" "),
    timestamp: new Date().toISOString(),
    url: window.location.href,
  });
}

export function installDevConsoleBridge() {
  if (!import.meta.env.DEV || isInstalled || typeof window === "undefined") {
    return;
  }

  isInstalled = true;

  (["log", "info", "warn", "error", "debug"] as const).forEach((level) => {
    const original = console[level].bind(console);

    console[level] = (...args: unknown[]) => {
      mirrorConsoleCall(level, original, args);
    };
  });

  window.addEventListener("error", (event) => {
    publishDevConsoleEntry({
      args: [event.message, event.filename, String(event.lineno), String(event.colno)],
      level: "error",
      message: event.message,
      source: "window.error",
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = serializeConsoleArg(event.reason);

    publishDevConsoleEntry({
      args: [reason],
      level: "error",
      message: reason,
      source: "unhandledrejection",
      timestamp: new Date().toISOString(),
      url: window.location.href,
    });
  });

  publishDevConsoleEntry({
    args: [],
    level: "info",
    message: "Dev console bridge connected.",
    source: "devConsoleBridge",
    timestamp: new Date().toISOString(),
    url: window.location.href,
  });
}
