"use client";

/** Opens the course advisor (bottom-left), optionally sending a first message. */
export const ADVISOR_OPEN_EVENT = "fm:advisor-open";

export function openAdvisor(message?: string) {
  window.dispatchEvent(new CustomEvent(ADVISOR_OPEN_EVENT, { detail: { message } }));
}

export function OpenAdvisorButton({ className, message, children }: { className?: string; message?: string; children: React.ReactNode }) {
  return (
    <button type="button" className={className} onClick={() => openAdvisor(message)}>
      {children}
    </button>
  );
}
