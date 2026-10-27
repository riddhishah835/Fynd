export default function Loader() {
  return (
    <div className="flex min-h-16 items-center justify-center gap-3 text-sm text-slate-500" role="status">
      <svg aria-hidden="true" className="h-5 w-5 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeLinecap="round" strokeWidth="3" />
      </svg>
      <span>Loading...</span>
    </div>
  );
}
