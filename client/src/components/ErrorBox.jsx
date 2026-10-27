export default function ErrorBox({ message }) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm"
      role="alert"
    >
      <svg aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24">
        <path d="M12 8v4m0 4h.01M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3l-7.5-13a2 2 0 0 0-3.4-.1Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
      </svg>
      <span>{message}</span>
    </div>
  );
}
