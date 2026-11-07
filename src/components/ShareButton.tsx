import { useEffect, useState } from "react";

type Status = "idle" | "copied" | "failed";

const LABELS: Record<Status, string> = {
  idle: "Copy link",
  copied: "Link copied",
  failed: "Copy the URL from the address bar",
};

interface Props {
  /** The share link of the person on screen, which may be ahead of the address bar. */
  link: string;
}

/** Copies the share link, which holds the whole state, so it can be shared. */
export default function ShareButton({ link }: Props) {
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timeout = window.setTimeout(() => setStatus("idle"), 2400);
    return () => window.clearTimeout(timeout);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <button type="button" className="share-button" data-status={status} onClick={copy}>
      <svg className="share-icon" viewBox="0 0 16 16" aria-hidden="true">
        {status === "copied" ? (
          <path d="M3 8.5l3 3 7-7" />
        ) : (
          <path d="M6.5 9.5l3-3M7 4.5l1.3-1.3a2.8 2.8 0 014 4L11 8.5M9 11.5l-1.3 1.3a2.8 2.8 0 01-4-4L5 7.5" />
        )}
      </svg>
      <span aria-live="polite">{LABELS[status]}</span>
    </button>
  );
}
