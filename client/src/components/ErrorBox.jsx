export default function ErrorBox({ message }) {
  return (
    <div
      className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
      role="alert"
    >
      {message}
    </div>
  );
}
