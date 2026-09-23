# Курсовая работа Fun-Walk (LaTeX)

Пояснительная записка к проекту **Fun-Walk** — веб-приложению для планирования пешеходных маршрутов.

## Быстрая сборка (одна команда)

### Windows (PowerShell)

```powershell
cd coursework
.\build.ps1
```

Или через `.bat` (без проблем с политикой PowerShell):

```cmd
cd coursework
build.bat
```

Из корня проекта:

```powershell
npm run coursework
```

### Linux / Ubuntu

```bash
cd coursework
chmod +x build.sh
./build.sh
```

## Результат сборки

| Файл | Описание |
|------|----------|
| `build/fun-walk-coursework.docx` | Word-документ (основной результат) |

## Требования

| Инструмент | Назначение | Установка |
|------------|------------|-----------|
| **Pandoc** | Сборка DOCX | `winget install JohnMacFarlane.Pandoc` |

Опционально: **latexpand** (из TeX Live) — лучше разворачивает `\input{}` перед конвертацией.

## Настройка титульного листа

Отредактируйте переменные в `gost.sty`:

- `\university`, `\faculty`, `\department`
- `\studentname`, `\studentgroup`, `\supervisor`
- `\city`, `\yearwork`

## Структура документа

```
coursework/
├── main.tex              # Главный файл
├── gost.sty              # Оформление по ГОСТ 7.32-2017
├── bibliography.bib      # Список литературы
├── chapters/             # Главы
├── appendices/           # Приложения (листинги кода)
├── build.ps1 / build.bat / build.sh
└── build/                # Результаты сборки (gitignore)
```

## Примечание о DOCX

DOCX генерируется через Pandoc из LaTeX-исходников. Формулы и таблицы могут потребовать ручной правки в Word. Для лучшего качества установите TeX Live (утилита `latexpand`).

## Очистка

```bash
rm -rf build/
```
