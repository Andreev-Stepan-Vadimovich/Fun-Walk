# Fun-Walk

**Fun-Walk** — веб-приложение для планирования маршрутов прогулок с учётом пожеланий пользователя: зелёные зоны, велодорожки, качество воздуха, тихие места и набережные.

> Курсовая работа. Демо-режим использует симулированные данные по центру **Ярославля**.

## Стек технологий

| Часть | Технологии |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Leaflet |
| Backend | NestJS 10, TypeScript, class-validator |

## Структура проекта

```
Fun-Walk/
├── backend/              # NestJS API
│   ├── .env.example      # Пример переменных окружения
│   └── src/
│       ├── config/       # Конфигурация (порт, CORS, OSRM)
│       └── routes/       # Планирование маршрутов, POI, метрики
├── frontend/             # React SPA
│   └── src/
│       └── components/
├── scripts/
│   ├── dev.sh            # Быстрый запуск (Ubuntu / Linux)
│   └── dev.ps1           # Быстрый запуск (Windows PowerShell)
├── package.json          # Общие npm-скрипты (dev, build)
└── README.md
```

## Требования

- **Node.js** >= 18
- **npm** >= 9

Приложение кросс-платформенное и работает на **Ubuntu / Linux** и **Windows 10/11**.

---

## Установка

### 1. Клонирование репозитория

```bash
git clone <url-репозитория>
cd Fun-Walk
```

### 2. Установка зависимостей

**Вариант A — одной командой из корня проекта:**

```bash
npm install
npm run install:all
```

**Вариант B — по отдельности:**

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 3. Настройка окружения (backend)

Скопируйте файл-пример и при необходимости отредактируйте значения:

```bash
cp backend/.env.example backend/.env
```

На Windows (PowerShell):

```powershell
Copy-Item backend\.env.example backend\.env
```

---

## Запуск на Ubuntu / Linux

### Быстрый старт (рекомендуется)

Скрипт установит зависимости, создаст `.env` и запустит оба сервиса:

```bash
chmod +x scripts/dev.sh
./scripts/dev.sh
```

### Ручной запуск в двух терминалах

**Терминал 1 — Backend (порт 3000):**

```bash
cd backend
npm run start:dev
```

**Терминал 2 — Frontend (порт 5173):**

```bash
cd frontend
npm run dev
```

### Запуск одной командой из корня

```bash
npm install          # только при первом запуске
npm run dev
```

После запуска:

| Сервис | URL |
|--------|-----|
| Приложение | http://127.0.0.1:5173 |
| API | http://127.0.0.1:3000 |
| Health-check | http://127.0.0.1:3000/api/health |

> Vite проксирует запросы `/api/*` на backend — отдельная настройка CORS в браузере не нужна.

---

## Запуск на Windows

### Предварительные требования

1. Установите [Node.js LTS](https://nodejs.org/) (версия 18 или новее).  
   Node.js **всегда** ставится на диск C (`C:\Program Files\nodejs\`) — это нормально.  
   Проект может лежать на любом диске (E:, D: и т.д.) — это не мешает работе.
2. **Полностью перезапустите Cursor** после установки Node.js (закройте приложение и откройте снова), чтобы терминал подхватил PATH.
3. Проверьте, что Node доступен:

```powershell
node -v
npm.cmd -v
```

> В PowerShell команда `npm` может блокироваться политикой безопасности (файл `npm.ps1`).
> Используйте **`npm.cmd`** вместо `npm`, либо выполните однократно:
> ```powershell
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
> ```
> После этого `npm -v` будет работать как обычно.

Если команды не находятся, добавьте Node в PATH **для текущей сессии**:

```powershell
$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
node -v
```

### Быстрый старт (рекомендуется)

**Вариант A — через .bat (без проблем с политикой PowerShell):**

```cmd
cd E:\Zaya\Fun-Walk
scripts\dev.bat
```

**Вариант B — через PowerShell:**

```powershell
cd E:\Zaya\Fun-Walk
.\scripts\dev.ps1
```

Если PowerShell блокирует `.ps1`-скрипты:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\dev.ps1
```

### Ручной запуск в двух терминалах

**Терминал 1 — Backend:**

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run start:dev
```

**Терминал 2 — Frontend:**

```powershell
cd frontend
npm install
npm run dev
```

### Запуск одной командой из корня

```powershell
cd Fun-Walk
npm install
npm run install:all
npm run dev
```

После запуска откройте в браузере: **http://127.0.0.1:5173**

### Частые проблемы на Windows

| Проблема | Решение |
|----------|---------|
| `'npm' is not recognized` | Node установлен на C:, но терминал не видит PATH. **Перезапустите Cursor** или выполните: `$env:PATH = "C:\Program Files\nodejs;" + $env:PATH` |
| `npm.ps1` / `выполнение сценариев отключено` | В PowerShell: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` **или** используйте `npm.cmd` / `scripts\dev.bat` |
| Порт 3000 или 5173 занят | Закройте другой процесс или измените `PORT` в `backend/.env` |
| Frontend не видит backend | Убедитесь, что backend запущен; проверьте http://127.0.0.1:3000/api/health |
| Брандмауэр Windows | Разрешите Node.js доступ к частной сети при первом запросе |

> **Примечание:** В PowerShell используйте `;` вместо `&&` для цепочки команд:  
> `cd backend; npm run start:dev`

---

## Сборка для production

```bash
# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build
npm run preview   # предпросмотр на порту 4173
```

Или из корня:

```bash
npm run build
npm run start:prod    # только backend
npm run preview       # только frontend preview
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/api/health` | Проверка работоспособности |
| GET | `/api/defaults` | Точки старта/финиша по умолчанию |
| GET | `/api/poi` | Список точек интереса (парки, велодорожки и т.д.) |
| GET | `/api/routes` | Список сохранённых маршрутов |
| GET | `/api/routes/:id` | Детали маршрута |
| POST | `/api/routes/plan` | Построить новый маршрут |
| DELETE | `/api/routes/:id` | Удалить маршрут |

### Пример запроса POST `/api/routes/plan`

```json
{
  "start": { "lat": 57.6265, "lng": 39.8938 },
  "end": { "lat": 57.6289, "lng": 39.8712 },
  "preferences": {
    "nature": 8,
    "bikePaths": 5,
    "airQuality": 8,
    "quietAreas": 6,
    "waterfront": 4
  },
  "name": "Моя прогулка"
}
```

## Как пользоваться

1. Откройте http://127.0.0.1:5173
2. Настройте **приоритеты** с помощью ползунков (0–10)
3. При необходимости измените **старт** и **финиш**, кликнув кнопку и затем точку на карте
4. Нажмите **«Построить маршрут»**
5. На карте отобразится маршрут, слева — метрики (дистанция, AQI, зелёное покрытие, балл)
6. Маршруты сохраняются в сессии и доступны в блоке «Сохранённые маршруты»

## Алгоритм планирования

Построение маршрута выполняет сервис `RoutePlannerService` (`backend/src/routes/planner/`).

### 1. Математическая модель оценки POI

Каждая точка интереса описывается **признаковым вектором** f(p) ∈ ℝ⁶:

| Компонента | Значение |
|-----------|----------|
| nature, bikePaths, waterfront | типовые признаки (природа = парки + скверы + бульвары) |
| airQuality | (100 − AQI) / 100 |
| quietAreas | (100 − noise) / 100 |

**Вектор предпочтений** пользователя w ∈ ℝ⁶ формируется из ползунков (0–10).

**Оценка POI** (скалярное произведение с штрафом за отклонение):

```
score(p) = (w · f(p)) / ‖w‖ − α · d⊥(p, S→E)
```

где d⊥ — перпендикулярное расстояние от POI до отрезка «старт–финиш» (проекция на отрезок), α = 0.15.

### 2. Построение взвешенного графа G = (V, E)

- **V** = {start, end} ∪ {топ POI с score > 0.05, не более 8}
- **E** — k-NN связность (k = 4) + все пары с расстоянием ≤ 3.5 км
- **Вес ребра** (формула Haversine + привлекательность):

```
w(u,v) = d_H(u,v) / (1 + η · max(Ã(u), Ã(v)))
```

где d_H — расстояние Haversine на сфере (R = 6371 км), η = 2.5, Ã — нормализованная привлекательность ∈ [0, 1].

Чем «лучше» вершина, тем меньше эффективный вес ребра → алгоритм «тянет» маршрут через парки и набережные.

### 3. Алгоритм Dijkstra

На графе ищется **кратчайший путь** от `start` до `end` алгоритмом Dijkstra:

```
dist[v] = min(dist[v], dist[u] + w(u,v))   // релаксация рёбер
```

Сложность: O((V + E) log V). Реализация: `backend/src/routes/planner/graph/dijkstra.ts`.

### 4. Маршрутизация по проходимым путям (OSRM)

После выбора POI алгоритмом Dijkstra геометрия маршрута строится через **OSRM**
(Open Source Routing Machine) с профилем `foot` — данные OpenStreetMap:

- тротуары, пешеходные дорожки, аллеи парков
- маршрут **не** идёт через здания, реки и непроходимые зоны
- точки автоматически «привязываются» (snap) к ближайшей дороге

```
GET /route/v1/foot/{lon,lat;...}?overview=full&geometries=geojson
```

Сервис: `backend/src/routes/planner/routing/osrm-routing.service.ts`

### 5. Расчёт метрик

- Расчёт метрик: суммарная длина (из OSRM или Haversine), покрытие зелёными зонами, средний AQI, итоговый балл

### Структура planner-модуля

```
backend/src/routes/planner/
├── route-planner.service.ts   # оркестрация
├── math/
│   ├── geo.util.ts            # Haversine, проекция на отрезок
│   └── poi-scoring.util.ts    # w · f(p), отбор POI
├── graph/
│   ├── graph.types.ts         # типы графа
│   └── dijkstra.ts            # алгоритм Dijkstra
└── routing/
    └── osrm-routing.service.ts # маршруты по дорогам OSM (foot)
```

## Переменные окружения

Файл `backend/.env` (создаётся из `backend/.env.example`):

| Переменная | По умолчанию | Описание |
|-----------|--------------|----------|
| `PORT` | `3000` | Порт backend |
| `HOST` | `0.0.0.0` | Адрес прослушивания API |
| `OSRM_URL` | `https://router.project-osrm.org` | URL OSRM-сервера для пешеходной маршрутизации |
| `CORS_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Разрешённые origin (через запятую) |

## Автор

Курсовая работа — Fun-Walk
