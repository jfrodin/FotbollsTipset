# FotbollsTipset ⚽

Tippa fotbollsturneringar med kollegor. Byggd för VM 2026 men återanvändbar för framtida turneringar.

## Driftsätta (för Ruben)

### Krav
- Docker + Docker Compose
- En domän med SSL (appen antar HTTPS i produktion)

### 1. Klona repot

```bash
git clone https://github.com/jfrodin/FotbollsTipset.git
cd FotbollsTipset/fotbollstipset
```

### 2. Skapa miljövariabler

```bash
cp .env.example .env
```

Öppna `.env` och fyll i:

| Variabel | Beskrivning |
|---|---|
| `DATABASE_URL` | Lämna som det är om du kör med docker-compose nedan |
| `AUTH_SECRET` | Kör: `openssl rand -base64 32` |
| `RESEND_API_KEY` | API-nyckel från resend.com |
| `FROM_EMAIL` | t.ex. `noreply@speltorsk.madnuss.com` |
| `CRON_SECRET` | Kör: `openssl rand -hex 32` |
| `APP_URL` | t.ex. `https://speltorsk.madnuss.com` |
| `FOOTBALL_API_KEY` | API-nyckel från api-football.com (kan lämnas tom tills vidare) |

### 3. Starta

```bash
docker compose up -d
```

Det är allt. Appen startar, databasen skapas och migrationer körs automatiskt.

Öppna `https://speltorsk.madnuss.com` i webbläsaren.

### 4. Skapa admin-användare

Logga in med din e-post på sajten. Kör sen:

```bash
docker compose exec db psql -U postgres fotbollstipset -c \
  "UPDATE users SET role = 'admin' WHERE email = 'din@epost.se';"
```

### 5. Lägg till VM 2026 (i adminpanelen)

Logga in → gå till `/admin` → skapa turnering.

---

## Automatisk synkronisering

För att hämta matchresultat automatiskt, sätt upp ett cron-jobb som anropar:

```
GET https://speltorsk.madnuss.com/api/cron/sync
Header: x-cron-secret: <ditt CRON_SECRET>
```

Rekommenderat intervall: var 5:e minut under matchdagar.

---

## Lokal utveckling

```bash
cp .env.example .env.local
# Fyll i DATABASE_URL med en Postgres-databas
npm install --legacy-peer-deps
npm run db:migrate
npm run dev
```

Inloggningskoder skrivs ut i terminalen om `RESEND_API_KEY` saknas.
