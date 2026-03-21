import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

const SESSION_KEY = "lumina_analytics_session";

function getSessionId(): string {
  let id = sessionStorage.getItem(SESSION_KEY);
  if (!id) {
    id = `s_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    sessionStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function trackPageView(path: string, contentType?: string, contentId?: string) {
  const sessionId = getSessionId();
  fetch("/api/analytics/track", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-session-id": sessionId },
    body: JSON.stringify({
      path,
      referrer: document.referrer || null,
      contentType: contentType || null,
      contentId: contentId || null,
    }),
  }).catch(() => {});
}

export function usePageTracking() {
  const [location] = useLocation();
  const lastTracked = useRef("");

  useEffect(() => {
    if (location !== lastTracked.current) {
      lastTracked.current = location;

      let contentType: string | undefined;
      let contentId: string | undefined;

      const bookMatch = location.match(/^\/book\/(.+)$/);
      const courseMatch = location.match(/^\/course\/(.+?)(?:\/|$)/);

      if (bookMatch) {
        contentType = "book";
        contentId = bookMatch[1];
      } else if (courseMatch) {
        contentType = "course";
        contentId = courseMatch[1];
      }

      trackPageView(location, contentType, contentId);
    }
  }, [location]);
}
