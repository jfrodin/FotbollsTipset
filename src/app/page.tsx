import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { tournaments, matches, predictions } from "@/db/schema";
import { eq, and, asc, gte } from "drizzle-orm";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { redirect } from "next/navigation";

async function getActiveTournament() {
  const [active] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, "active"))
    .limit(1);
  if (active) return active;

  const [open] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.status, "open"))
    .limit(1);
  return open ?? null;
}

export default async function HomePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const tournament = await getActiveTournament();

  let upcomingMatches: (typeof matches.$inferSelect)[] = [];
  let pendingCount = 0;

  if (tournament) {
    const now = new Date();
    upcomingMatches = await db
      .select()
      .from(matches)
      .where(and(eq(matches.tournamentId, tournament.id), gte(matches.startsAt, now)))
      .orderBy(asc(matches.startsAt))
      .limit(5);

    const soon = upcomingMatches.filter(
      (m) => new Date(m.startsAt) <= new Date(Date.now() + 48 * 60 * 60 * 1000)
    );

    if (soon.length > 0) {
      const userPreds = await db
        .select({ matchId: predictions.matchId })
        .from(predictions)
        .where(and(eq(predictions.tournamentId, tournament.id), eq(predictions.userId, session.id)));

      const tipped = new Set(userPreds.map((p) => p.matchId));
      pendingCount = soon.filter((m) => !tipped.has(m.id)).length;
    }
  }

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Hej, {session.displayName}!</h1>
          {tournament ? (
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {tournament.name} {tournament.year}
            </p>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Ingen aktiv turnering just nu.
            </p>
          )}
        </div>

        {tournament && (
          <>
            {pendingCount > 0 && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6">
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  ⚠️ Du har {pendingCount} match{pendingCount !== 1 ? "er" : ""} att tippa de närmaste 48 timmarna!
                </span>
                <Link
                  href={`/tournament/${tournament.id}/group`}
                  className="block text-sm text-amber-600 dark:text-amber-400 hover:underline mt-1"
                >
                  Tippa nu →
                </Link>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <Link
                href={`/tournament/${tournament.id}/group`}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-green-400 dark:hover:border-green-600 transition-colors group"
              >
                <div className="text-3xl mb-2">🏟️</div>
                <div className="font-semibold group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  Gruppspel
                </div>
                <div className="text-sm text-gray-500 mt-0.5">Tippa matcherna</div>
              </Link>

              <Link
                href={`/tournament/${tournament.id}/knockout`}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-green-400 dark:hover:border-green-600 transition-colors group"
              >
                <div className="text-3xl mb-2">🏆</div>
                <div className="font-semibold group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  Slutspel
                </div>
                <div className="text-sm text-gray-500 mt-0.5">Tippa slutspelet</div>
              </Link>

              <Link
                href={`/tournament/${tournament.id}/leaderboard`}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-green-400 dark:hover:border-green-600 transition-colors group"
              >
                <div className="text-3xl mb-2">📊</div>
                <div className="font-semibold group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  Tabell
                </div>
                <div className="text-sm text-gray-500 mt-0.5">Se ställningen</div>
              </Link>
            </div>

            {upcomingMatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Kommande matcher</h2>
                <div className="space-y-2">
                  {upcomingMatches.map((m) => (
                    <div
                      key={m.id}
                      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center justify-between text-sm"
                    >
                      <span className="text-gray-600 dark:text-gray-300">
                        {new Date(m.startsAt).toLocaleDateString("sv-SE", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: "Europe/Stockholm",
                        })}
                        {" · "}
                        {new Date(m.startsAt).toLocaleTimeString("sv-SE", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Stockholm",
                        })}
                      </span>
                      <span className="text-gray-400 text-xs">{m.roundName ?? ""}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
