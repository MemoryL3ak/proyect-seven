// Bidirectional bridge between the Next.js web app (running inside the
// React Native WebView) and the native shell. See seven-arena-app/BRIDGE.md
// for the contract, message types, and examples.

const PROTOCOL_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 5000;

type Envelope = {
  v: 1;
  id?: string;
  type: string;
  payload?: unknown;
  ok?: boolean;
  error?: string;
};

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

type Listener = (payload: unknown) => void;

const pending = new Map<string, Pending>();
const listeners = new Map<string, Set<Listener>>();

function getRN(): { postMessage: (s: string) => void } | null {
  if (typeof window === "undefined") return null;
  const rn = (window as unknown as {
    ReactNativeWebView?: { postMessage?: (s: string) => void };
  }).ReactNativeWebView;
  return rn && typeof rn.postMessage === "function"
    ? (rn as { postMessage: (s: string) => void })
    : null;
}

export function isAvailable(): boolean {
  return getRN() !== null;
}

function genId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function rawSend(env: Envelope): void {
  const rn = getRN();
  if (!rn) return;
  try {
    rn.postMessage(JSON.stringify(env));
  } catch {
    // swallow — RN side decides what to do
  }
}

export function send(type: string, payload?: unknown): void {
  rawSend({ v: PROTOCOL_VERSION, type, payload });
}

export function request<T = unknown>(
  type: string,
  payload?: unknown,
  opts?: { timeoutMs?: number },
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (!isAvailable()) {
      reject(new Error("native bridge unavailable (running outside WebView)"));
      return;
    }
    const id = genId();
    const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`bridge.request("${type}") timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, {
      resolve: resolve as (value: unknown) => void,
      reject,
      timer,
    });
    rawSend({ v: PROTOCOL_VERSION, id, type, payload });
  });
}

export function on(type: string, handler: Listener): () => void {
  let set = listeners.get(type);
  if (!set) {
    set = new Set();
    listeners.set(type, set);
  }
  set.add(handler);
  return () => off(type, handler);
}

export function off(type: string, handler: Listener): void {
  const set = listeners.get(type);
  if (!set) return;
  set.delete(handler);
  if (set.size === 0) listeners.delete(type);
}

function deliver(env: Envelope): void {
  if (env.id && pending.has(env.id)) {
    const entry = pending.get(env.id)!;
    pending.delete(env.id);
    clearTimeout(entry.timer);
    if (env.ok === false) {
      entry.reject(new Error(env.error || `bridge "${env.type}" failed`));
    } else {
      entry.resolve(env.payload);
    }
    return;
  }
  const set = listeners.get(env.type);
  if (!set) return;
  set.forEach((handler) => {
    try {
      handler(env.payload);
    } catch {
      // swallow listener errors so one bad subscriber doesn't block the rest
    }
  });
}

function tryParse(raw: unknown): Envelope | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Envelope> | null;
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.v === PROTOCOL_VERSION &&
      typeof parsed.type === "string"
    ) {
      return parsed as Envelope;
    }
    return null;
  } catch {
    return null;
  }
}

if (typeof window !== "undefined") {
  // RN injects calls into this hook to deliver messages and responses.
  (window as unknown as {
    __sevenNativeReceive?: (raw: unknown) => void;
  }).__sevenNativeReceive = (raw) => {
    const env = tryParse(raw);
    if (env) deliver(env);
  };
}
