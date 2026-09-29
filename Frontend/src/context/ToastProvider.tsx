import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Alert from "../components/ui/alert/Alert";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  type?: ToastType;
  title?: string;
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  title: string;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, options?: ToastOptions) => number;
  success: (message: string, options?: Omit<ToastOptions, "type">) => number;
  error: (message: string, options?: Omit<ToastOptions, "type">) => number;
  warning: (message: string, options?: Omit<ToastOptions, "type">) => number;
  info: (message: string, options?: Omit<ToastOptions, "type">) => number;
  dismissToast: (id: number) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const MAX_VISIBLE_TOASTS = 3;
const DEFAULT_DURATION = 3000;

const DEFAULT_TITLES: Record<ToastType, string> = {
  success: "Success",
  error: "Error",
  warning: "Warning",
  info: "Information",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const clearTimer = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id: number) => {
      clearTimer(id);
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    },
    [clearTimer],
  );

  const clearToasts = useCallback(() => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const showToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = ++idRef.current;
      const type = options.type ?? "info";
      const duration = options.duration ?? DEFAULT_DURATION;

      const newToast: ToastItem = {
        id,
        message,
        type,
        title: options.title ?? DEFAULT_TITLES[type],
        duration,
      };

      setToasts((previous) => {
        const next = [newToast, ...previous];
        const removed = next.slice(MAX_VISIBLE_TOASTS);

        removed.forEach((toast) => clearTimer(toast.id));

        return next.slice(0, MAX_VISIBLE_TOASTS);
      });

      if (duration > 0) {
        const timer = setTimeout(() => {
          timersRef.current.delete(id);
          setToasts((previous) => previous.filter((toast) => toast.id !== id));
        }, duration);

        timersRef.current.set(id, timer);
      }

      return id;
    },
    [clearTimer],
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      showToast,
      success: (message, options = {}) =>
        showToast(message, { ...options, type: "success" }),
      error: (message, options = {}) =>
        showToast(message, { ...options, type: "error" }),
      warning: (message, options = {}) =>
        showToast(message, { ...options, type: "warning" }),
      info: (message, options = {}) =>
        showToast(message, { ...options, type: "info" }),
      dismissToast,
      clearToasts,
    }),
    [showToast, dismissToast, clearToasts],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        className="pointer-events-none fixed right-4 top-4 z-[1000000] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2 sm:right-5 sm:top-5"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <div key={toast.id} className="pointer-events-auto w-full">
            <Alert
              variant={toast.type}
              title={toast.title}
              message={toast.message}
              onClose={() => dismissToast(toast.id)}
            />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}
