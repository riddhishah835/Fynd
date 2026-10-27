export default function Empty({ message }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center shadow-sm">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-500">
        <svg aria-hidden="true" className="h-7 w-7" fill="none" viewBox="0 0 24 24">
          <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9ZM8 9h8m-8 3h5m-5 3h7" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
        </svg>
      </span>
      <p className="max-w-md text-sm leading-6 text-slate-600">{message}</p>
    </div>
  );
}
