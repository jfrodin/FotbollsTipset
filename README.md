# FotbollsTipset ⚽

Tippa fotbollsturneringar med kollegor. Byggd för VM 2026.

---

## Driftsätta (för Ruben)

Du behöver: **Docker + Docker Compose** installerat.

### 1. Klona repot

```bash
git clone https://github.com/jfrodin/FotbollsTipset.git
cd FotbollsTipset/fotbollstipset
```

### 2. Skapa .env-fil

```bash
cp .env.example .env
```

Öppna `.env` och fyll i värdena du fått av Joakim:

```
DATABASE_URL=...
AUTH_SECRET=...
GMAIL_USER=...
GMAIL_APP_PASSWORD=...
FOOTBALL_API_KEY=...
CRON_SECRET=...
APP_URL=https://speltorsk.madnuss.com
```

### 3. Starta

```bash
docker compose up -d
```

Det är allt. Appen startar på port 3000, migrationer körs automatiskt,
och matchresultat synkas automatiskt var 2:e timme via den inbyggda cron-containern.

---

## Lokal utveckling

```bash
cp .env.example .env.local
# Fyll i variabler
npm install
npm run dev
```
