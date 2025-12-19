import { useEffect, useState } from "react";

export type ChatVisibility = "minimized" | "expanded" | "closed";

const VISIBILITY_KEY = "atlas-chat-visibility";

const readStoredVisibility = (): ChatVisibility => {
  if (typeof window === "undefined") return "minimized";

  try {
    const stored = window.localStorage.getItem(VISIBILITY_KEY) as ChatVisibility | null;
    if (stored === "expanded" || stored === "closed" || stored === "minimized") {
      return stored;
    }
  } catch (error) {
    console.warn("[chat] failed to read visibility", error);
  }

  return "minimized";
};

const persistVisibility = (visibility: ChatVisibility) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VISIBILITY_KEY, visibility);
  } catch (error) {
    console.warn("[chat] failed to persist visibility", error);
  }
};

export const useChatWidgetState = (suppressed = false) => {
  const [visibility, setVisibility] = useState<ChatVisibility>(() => (suppressed ? "closed" : readStoredVisibility()));

  useEffect(() => {
    if (suppressed) {
      setVisibility("closed");
      return;
    }
    persistVisibility(visibility);
  }, [suppressed, visibility]);

  const open = () => setVisibility("expanded");
  const minimize = () => setVisibility("minimized");
  const close = () => setVisibility("closed");

  return {
    visibility,
    open,
    minimize,
    close,
    setVisibility,
    isExpanded: visibility === "expanded",
    isMinimized: visibility === "minimized",
    isClosed: visibility === "closed",
  };
};

export type UseChatWidgetStateReturn = ReturnType<typeof useChatWidgetState>;
