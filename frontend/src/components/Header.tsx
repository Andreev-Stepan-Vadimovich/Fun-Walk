export default function Header() {
  return (
    <header className="border-b border-white/5 bg-forest-950/60 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-forest-500 to-moss-600 shadow-glow">
            <svg
              className="h-6 w-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-white">
              Fun-Walk
            </h1>
            <p className="text-sm text-forest-300">
              Умный планировщик маршрутов прогулок
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 rounded-full border border-forest-600/30 bg-forest-900/50 px-4 py-1.5 text-xs text-forest-300 sm:flex">
          <span className="h-2 w-2 animate-pulse rounded-full bg-forest-400" />
          Москва · демо-режим
        </div>
      </div>
    </header>
  );
}
