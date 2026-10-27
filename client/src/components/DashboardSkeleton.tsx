export function DashboardSkeleton() {
  return (
    <div
      className="animate-pulse space-y-6"
      role="status"
      aria-live="polite"
      aria-label="Loading dashboard"
    >
      <span className="sr-only">Loading dashboard…</span>

      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="h-3 w-24 rounded-full bg-stone-200" />
              <div className="h-10 w-10 rounded-2xl bg-stone-100" />
            </div>
            <div className="mt-7 h-8 w-36 rounded-full bg-stone-200" />
            <div className="mt-3 h-3 w-28 rounded-full bg-stone-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className={`rounded-3xl border border-stone-200 bg-white p-6 shadow-sm ${
              item === 2 ? "md:col-span-2 xl:col-span-1" : ""
            }`}
          >
            <div className="h-5 w-36 rounded-full bg-stone-200" />
            <div className="mt-2 h-3 w-28 rounded-full bg-stone-100" />
            <div className="mt-7 h-8 w-32 rounded-full bg-stone-100" />
            <div className="mt-5 h-20 rounded-2xl bg-stone-100" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm lg:col-span-2">
          <div className="h-5 w-44 rounded-full bg-stone-200" />
          <div className="mt-2 h-3 w-56 rounded-full bg-stone-100" />
          <div className="mt-10 flex h-48 items-end gap-4 sm:h-56">
            {[56, 82, 44, 68, 90, 52].map((height, index) => (
              <div key={index} className="flex h-full flex-1 items-end">
                <div
                  className="w-full rounded-t-md bg-stone-100"
                  style={{ height: `${height}%` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          <div className="h-5 w-40 rounded-full bg-stone-200" />
          <div className="mt-2 h-3 w-32 rounded-full bg-stone-100" />
          <div className="mx-auto mt-8 h-40 w-40 rounded-full bg-stone-100" />
          <div className="mt-8 space-y-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-9 rounded-xl bg-stone-100" />
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="h-5 w-48 rounded-full bg-stone-200" />
        <div className="mt-6 space-y-4">
          {[0, 1, 2, 3, 4].map((item) => (
            <div key={item} className="h-12 rounded-xl bg-stone-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
