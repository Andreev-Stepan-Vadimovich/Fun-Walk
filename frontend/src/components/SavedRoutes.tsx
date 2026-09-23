import type { RouteSummary } from '../types';

interface Props {
  routes: RouteSummary[];
  activeId?: string;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function SavedRoutes({
  routes,
  activeId,
  onLoad,
  onDelete,
}: Props) {
  return (
    <div className="glass-card p-5">
      <h2 className="mb-3 font-display text-lg font-semibold text-sage-800">
        Сохранённые маршруты
      </h2>

      {routes.length === 0 ? (
        <p className="text-sm text-sage-500">
          Постройте первый маршрут — он появится здесь
        </p>
      ) : (
        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
          {routes.map((route) => (
            <li
              key={route.id}
              className={`group flex items-center justify-between rounded-xl border p-3 transition ${
                activeId === route.id
                  ? 'border-sage-400/60 bg-sage-50/80'
                  : 'border-sage-100 bg-white/50 hover:bg-sage-50/60'
              }`}
            >
              <button
                type="button"
                className="min-w-0 flex-1 text-left"
                onClick={() => onLoad(route.id)}
              >
                <p className="truncate text-sm font-medium text-sage-800">
                  {route.name}
                </p>
                <p className="text-xs text-sage-500">
                  {route.distanceKm} км · балл {route.score}
                </p>
              </button>
              <button
                type="button"
                className="ml-2 rounded-lg p-1.5 text-sage-400 opacity-0 transition hover:bg-blush-50 hover:text-blush-500 group-hover:opacity-100"
                onClick={() => onDelete(route.id)}
                title="Удалить"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
