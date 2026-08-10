# Resume — Senior DevOps

Статический сайт резюме + сравнение вакансии с резюме через **OpenCode**.

| Что | Где |
|-----|-----|
| Текст резюме (источник) | `content/resume.md` |
| Фото | `content/photo.jpg` (или `.png` / `.webp`) |
| UI | `public/` (обычный HTML/CSS/JS) |
| Промпт матчинга | `prompts/match.md` |
| Сервер | `server.mjs` |

Резюме правите **только в Markdown**. Сайт подхватывает файл на лету (`/api/resume.md`).

### Фото

Положите портрет рядом с резюме:

```bash
cp ~/Downloads/me.jpg ~/Documents/resume/content/photo.jpg
```

Поддерживаются имена: `photo.jpg|jpeg|png|webp|svg` и `avatar.*`.  
После замены файла обновите страницу — фото появится в hero и рядом с текстом резюме.

Сейчас в репозитории лежит плейсхолдер `content/photo.svg` (инициалы). Замените его своим портретом:

```bash
# пример: реальное фото перекроет svg (jpg/png имеют приоритет выше)
cp ~/Downloads/me.jpg ~/Documents/resume/content/photo.jpg
rm ~/Documents/resume/content/photo.svg   # опционально
```

---

## Быстрый старт (локально)

### 1. Требования

- **Node.js 20+**
- **OpenCode CLI** (`opencode`) и рабочий провайдер/модель

```bash
# OpenCode (если ещё нет)
curl -fsSL https://opencode.ai/install | bash

# Проверка моделей
opencode models | head
```

### 2. Установка и запуск

```bash
cd ~/Documents/resume
cp .env.example .env          # при желании поправьте OPENCODE_MODEL
npm install
npm start
```

Откройте: **http://127.0.0.1:8787**

Проверка API:

```bash
curl -s http://127.0.0.1:8787/api/health
```

### 3. Match вакансии

На сайте блок **«Соответствие вакансии»**:

- текст
- URL
- PDF

Сервер вызывает:

```text
opencode run --format json -m $OPENCODE_MODEL …
```

и показывает score / совпадения / пробелы.

---

## Деплой на сервер (прозрачный)

Есть **два** одинаково простых пути. Выберите один.

### Вариант A — systemd (рекомендуется)

С ноутбука:

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh user@YOUR_SERVER
# или:
# DEPLOY_PATH=/opt/resume ./scripts/deploy.sh user@YOUR_SERVER
```

Скрипт:

1. `rsync` проекта на сервер (`/opt/resume` по умолчанию)
2. `npm install --omit=dev`
3. ставит OpenCode, если нет
4. ставит unit `resume.service` и делает `systemctl enable --now`

На сервере один раз:

```bash
# Node 20+ (пример для Debian/Ubuntu)
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Авторизация OpenCode (интерактивно под тем же user, что в systemd)
opencode auth   # или opencode providers — как принято в вашей версии
```

Проверка:

```bash
sudo systemctl status resume
curl -s http://127.0.0.1:8787/api/health
```

Опционально nginx: скопируйте `deploy/nginx.conf.example` и выдайте TLS (certbot).

### Вариант B — Docker Compose

На сервере должны быть Docker + креды OpenCode в `~/.config/opencode`.

```bash
cd /opt/resume   # после rsync/git clone
cp .env.example .env
# В .env укажите абсолютный путь:
# OPENCODE_CONFIG_DIR=/home/ubuntu/.config/opencode

docker compose up -d --build
curl -s http://127.0.0.1:8787/api/health
```

Обновление резюме без пересборки: правьте `content/resume.md` (том смонтирован).

> Match **не работает** без валидных credentials OpenCode внутри контейнера/хоста.

---

## Конфиг (`.env`)

| Переменная | По умолчанию | Смысл |
|------------|--------------|--------|
| `PORT` | `8787` | порт HTTP |
| `OPENCODE_BIN` | `opencode` | путь к CLI |
| `OPENCODE_MODEL` | `opencode/deepseek-v4-flash-free` | бесплатная DeepSeek V4 Flash (Zen) для match |
| `OPENCODE_TIMEOUT_MS` | `180000` | таймаут анализа |
| `MAX_VACANCY_CHARS` | `80000` | лимит текста вакансии |

Сменить модель:

```bash
# список
opencode models

# в .env (бесплатная DeepSeek V4)
OPENCODE_MODEL=opencode/deepseek-v4-flash-free
```

---

## Как обновить резюме

1. Отредактируйте `content/resume.md`
2. Положите/замените `content/photo.jpg` при необходимости
3. Обновите контакты/образование/даты под себя
4. На сервере: `rsync` / `git pull` / снова `./scripts/deploy.sh`
5. Обновите страницу в браузере — MD и фото читаются с диска

Печать в PDF: кнопка **«Печать / PDF»** в шапке (системный диалог печати).

---

## Структура

```text
content/resume.md      ← источник резюме
content/photo.jpg      ← фото (опционально)
prompts/match.md       ← системный промпт сравнения
public/                ← HTML/CSS/JS
server.mjs             ← static + /api/match + /api/resume.md + /api/photo
deploy/resume.service  ← systemd unit-шаблон
deploy/nginx.conf.example
scripts/deploy.sh      ← one-shot деплой по SSH
Dockerfile / docker-compose.yml
```

---

## API

- `GET /api/health` — живость
- `GET /api/resume.md` — сырой Markdown
- `GET /api/photo` — фото из `content/`
- `GET /api/photo/meta` — есть ли фото (`{ ok, file }`)
- `POST /api/match` — JSON `{ "text": "..." }` или `{ "url": "..." }`, либо `multipart` поле `pdf`

---

## Troubleshooting

| Симптом | Что проверить |
|---------|----------------|
| Сайт открывается, match падает | `which opencode`, `opencode models`, креды |
| `OpenCode exit …` | смотрите journalctl: `sudo journalctl -u resume -n 100` |
| URL вакансии пустой | anti-bot у hh/linkedin — вставьте текст или PDF |
| Docker match fails | смонтирован ли `OPENCODE_CONFIG_DIR`, тот же user/home |

---

## Лицензия

Личный проект резюме. Используйте как угодно для себя.