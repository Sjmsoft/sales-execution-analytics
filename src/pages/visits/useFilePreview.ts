import { useEffect, useState } from "react";

/** Clears a transient (success/toast) message after a delay. */
export function useAutoDismiss(message: string, clear: () => void, delayMs = 4000) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(clear, delayMs);
    return () => window.clearTimeout(timeout);
  }, [message, clear, delayMs]);
}

/** Creates a local object-URL preview for a File; revoked on change/unmount. */
export function useFilePreview(file: File | null) {
  const [state, setState] = useState<{ file: File | null; url: string }>({ file, url: "" });

  if (state.file !== file) {
    // Derived-state adjustment during render (recommended React pattern).
    setState({ file, url: file ? URL.createObjectURL(file) : "" });
  }

  useEffect(() => {
    if (!state.url) return;
    return () => URL.revokeObjectURL(state.url);
  }, [state.url]);

  return state.url;
}
