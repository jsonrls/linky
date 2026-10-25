"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="workspace-ui shell workspace-recovery">
      <div className="empty-state" role="alert">
        <h1>We couldn’t load this page</h1>
        <p>The service may be temporarily unavailable. Please retry.</p>
        <button className="primary" onClick={reset}>
          Retry
        </button>
      </div>
    </main>
  );
}
