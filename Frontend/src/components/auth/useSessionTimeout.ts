import { useEffect } from "react";

const INACTIVITY_LIMIT = 10 * 60 * 1000; // 10 minutes

export default function useSessionTimeout() {
  useEffect(() => {
    let timer: any;

    const logout = () => {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      window.location.replace("/login");
    };

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, INACTIVITY_LIMIT);
    };

    const events = ["mousemove", "keydown", "click", "scroll"];

    events.forEach((event) =>
      window.addEventListener(event, resetTimer)
    );

    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((event) =>
        window.removeEventListener(event, resetTimer)
      );
    };
  }, []);
}