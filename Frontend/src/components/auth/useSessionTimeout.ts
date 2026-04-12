import { useEffect } from "react";

const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes
const LAST_ACTIVITY_KEY = "lastActivity";

export default function useSessionTimeout() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const logout = () => {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      localStorage.removeItem(LAST_ACTIVITY_KEY);
      window.location.replace("/signin");
    };

    const resetTimer = () => {
      const now = Date.now();

      // 🔁 Update shared activity time
      localStorage.setItem(LAST_ACTIVITY_KEY, now.toString());

      clearTimeout(timer);
      timer = setTimeout(logout, INACTIVITY_LIMIT);
    };

    const checkTimeout = () => {
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_KEY));
      const now = Date.now();

      if (lastActivity && now - lastActivity > INACTIVITY_LIMIT) {
        logout();
      } else {
        clearTimeout(timer);
        timer = setTimeout(logout, INACTIVITY_LIMIT);
      }
    };

    // 🔄 Sync across tabs
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_KEY) {
        checkTimeout();
      }

      if (event.key === "token" && !event.newValue) {
        // another tab logged out
        logout();
      }
    };

    const events = ["mousemove", "keydown", "click", "scroll"];

    events.forEach((event) =>
      window.addEventListener(event, resetTimer)
    );

    window.addEventListener("storage", handleStorage);

    // initial check
    checkTimeout();

    return () => {
      clearTimeout(timer);

      events.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );

      window.removeEventListener("storage", handleStorage);
    };
  }, []);
}