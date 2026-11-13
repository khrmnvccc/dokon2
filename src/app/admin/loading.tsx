/** Sahifa yuklanguncha: videodagi kabi kulrang skelet (darhol koʻrinadi, server javobini kutmaydi). */
export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Yuklanmoqda">
      <div className="mb-5 flex gap-2">
        <div className="skeleton h-9 w-28 rounded-xl" />
        <div className="skeleton h-9 w-24 rounded-xl" />
        <div className="skeleton ml-auto h-9 w-56 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-surface-solid p-4">
            <div className="skeleton size-9 rounded-xl" />
            <div className="skeleton mt-4 h-4 w-24" />
            <div className="skeleton mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-surface-solid p-4">
        <div className="skeleton mb-4 h-4 w-48" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="mb-2 flex items-center gap-3 rounded-xl border border-line p-3">
            <div className="skeleton size-8 rounded-lg" />
            <div className="skeleton h-3 flex-1" />
            <div className="skeleton h-3 w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}
