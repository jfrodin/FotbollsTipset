import { getSession } from "@/lib/auth/session";
import { db } from "@/db";
import { tournaments, matches, predictions, teams, users, phases } from "@/db/schema";
import { eq, and, asc, gte, sum, sql, count } from "drizzle-orm";
import { Navbar } from "@/components/Navbar";
import { CountryFlag } from "@/components/CountryFlag";
import { TermsModal } from "@/components/TermsModal";
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
  if (!session.profileComplete) redirect("/setup");

  const tournament = await getActiveTournament();

  type LeaderboardEntry = { userId: string; displayName: string; points: number; rank: number };
  let leaderboard: LeaderboardEntry[] = [];

  type UpcomingMatch = typeof matches.$inferSelect & {
    homeTeam: { name: string; countryCode: string | null } | null;
    awayTeam: { name: string; countryCode: string | null } | null;
  };
  let upcomingMatches: UpcomingMatch[] = [];
  let pendingCount = 0;
  const [{ acceptedCount }] = await db.select({ acceptedCount: count().mapWith(Number) }).from(users).where(eq(users.hasAcceptedTerms, true));
  const prizePool = acceptedCount * 50;
  let hasKnockout = false;

  // Claudes senaste tips + statistik
  type ClaudeTip = {
    homeTeam: string; awayTeam: string; homeCode: string | null; awayCode: string | null;
    homeScore: number; awayScore: number; analysis: string | null; startsAt: Date;
  };
  let claudeTip: ClaudeTip | null = null;
  type ClaudeStats = { total: number; exact: number; outcome: number; points: number };
  let claudeStats: ClaudeStats = { total: 0, exact: 0, outcome: 0, points: 0 };
  const [claudeBot] = await db.select({ id: users.id }).from(users).where(eq(users.email, "claude@anthropic.com")).limit(1);

  if (tournament) {
    const topRows = await db
      .select({
        userId: predictions.userId,
        displayName: users.displayName,
        points: sum(predictions.points).mapWith(Number),
      })
      .from(predictions)
      .innerJoin(users, eq(predictions.userId, users.id))
      .where(eq(predictions.tournamentId, tournament.id))
      .groupBy(predictions.userId, users.displayName)
      .orderBy(sql`sum(${predictions.points}) desc nulls last`)
      .limit(5);

    leaderboard = topRows.map((r, i) => ({
      userId: r.userId,
      displayName: r.displayName,
      points: r.points ?? 0,
      rank: i + 1,
    }));

    const now = new Date();
    const rows = await db
      .select()
      .from(matches)
      .where(and(eq(matches.tournamentId, tournament.id), gte(matches.startsAt, now)))
      .orderBy(asc(matches.startsAt))
      .limit(5);

    const allTeams = await db.select().from(teams);
    const teamMap = new Map(allTeams.map((t) => [t.id, t]));

    upcomingMatches = rows.map((m) => ({
      ...m,
      homeTeam: m.homeTeamId ? (teamMap.get(m.homeTeamId) ?? null) : null,
      awayTeam: m.awayTeamId ? (teamMap.get(m.awayTeamId) ?? null) : null,
    }));

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

    const [knockoutPhase] = await db
      .select({ id: phases.id })
      .from(phases)
      .where(and(eq(phases.tournamentId, tournament.id), eq(phases.type, "knockout")))
      .limit(1);
    hasKnockout = !!knockoutPhase;

    if (claudeBot) {
      // Nästa match Claude har tippat
      const now2 = new Date();
      const [nextTip] = await db
        .select({
          homeScore: predictions.predictedHomeScore,
          awayScore: predictions.predictedAwayScore,
          analysis: predictions.analysis,
          startsAt: matches.startsAt,
          homeTeamId: matches.homeTeamId,
          awayTeamId: matches.awayTeamId,
        })
        .from(predictions)
        .innerJoin(matches, eq(predictions.matchId, matches.id))
        .where(and(eq(predictions.userId, claudeBot.id), eq(predictions.tournamentId, tournament.id), gte(matches.startsAt, now2)))
        .orderBy(asc(matches.startsAt))
        .limit(1);

      if (nextTip) {
        const allTeams2 = await db.select().from(teams);
        const tm = new Map(allTeams2.map(t => [t.id, t]));
        const ht = nextTip.homeTeamId ? tm.get(nextTip.homeTeamId) : null;
        const at = nextTip.awayTeamId ? tm.get(nextTip.awayTeamId) : null;
        claudeTip = {
          homeTeam: ht?.name ?? "?", awayTeam: at?.name ?? "?",
          homeCode: ht?.countryCode ?? null, awayCode: at?.countryCode ?? null,
          homeScore: nextTip.homeScore, awayScore: nextTip.awayScore,
          analysis: nextTip.analysis, startsAt: nextTip.startsAt,
        };
      }

      // Claudes statistik
      const claudePreds = await db.select().from(predictions)
        .where(and(eq(predictions.userId, claudeBot.id), eq(predictions.tournamentId, tournament.id)));
      claudeStats = {
        total: claudePreds.filter(p => p.points !== null).length,
        exact: claudePreds.filter(p => p.isExactScore).length,
        outcome: claudePreds.filter(p => p.isCorrectOutcome && !p.isExactScore).length,
        points: claudePreds.reduce((sum, p) => sum + (p.points ?? 0), 0),
      };
    }
  }

  return (
    <>
      {!session.hasAcceptedTerms && <TermsModal />}
      <Navbar user={session} />
      <div className="bg-gradient-to-br from-green-700 via-green-600 to-emerald-500 text-white">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <p className="text-green-200 text-sm font-medium uppercase tracking-widest mb-1">
            {tournament ? `${tournament.name} ${tournament.year}` : "FotbollsTipset"}
          </p>
          <h1 className="font-[family-name:var(--font-bebas)] text-5xl sm:text-6xl tracking-wide leading-none">
            Hej, {session.displayName}!
          </h1>
          {!tournament && (
            <p className="text-green-200 mt-2 text-sm">Ingen aktiv turnering just nu.</p>
          )}
          <Link href="/rules" className="inline-block mt-4 text-sm text-green-200 hover:text-white underline underline-offset-2 transition-colors">
            Hur funkar det? →
          </Link>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 py-8 flex-1 w-full">
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

            {prizePool > 0 && (
              <div className="bg-gradient-to-r from-yellow-400 to-amber-400 rounded-xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide">Prispott</p>
                  <p className="text-3xl font-[family-name:var(--font-bebas)] tracking-wide text-amber-900">{prizePool} kr</p>
                </div>
                <span className="text-5xl">🏆</span>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
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

              {hasKnockout ? (
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
              ) : (
                <div className="bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 rounded-xl p-5 opacity-50 cursor-not-allowed">
                  <div className="text-3xl mb-2">🔒</div>
                  <div className="font-semibold text-gray-400">Slutspel</div>
                  <div className="text-sm text-gray-400 mt-0.5">Låses upp efter gruppspelet</div>
                </div>
              )}

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

              <Link
                href={`/tournament/${tournament.id}/standings`}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 hover:border-green-400 dark:hover:border-green-600 transition-colors group"
              >
                <div className="text-3xl mb-2">🌍</div>
                <div className="font-semibold group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  VM-ställning
                </div>
                <div className="text-sm text-gray-500 mt-0.5">Grupperna i VM</div>
              </Link>
            </div>

            {leaderboard.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Topplista</h2>
                  <Link href={`/tournament/${tournament.id}/leaderboard`} className="text-sm text-green-600 dark:text-green-400 hover:underline">
                    Visa alla →
                  </Link>
                </div>
                <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                  {leaderboard.map((entry, i) => (
                    <div
                      key={entry.userId}
                      className={`flex items-center gap-3 px-4 py-3 text-sm ${i < leaderboard.length - 1 ? "border-b border-gray-100 dark:border-gray-800" : ""} ${entry.userId === session.id ? "bg-green-50 dark:bg-green-950/20" : ""}`}
                    >
                      <span className={`w-6 text-center font-bold ${entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-gray-400" : entry.rank === 3 ? "text-amber-600" : "text-gray-400"}`}>
                        {entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : entry.rank === 3 ? "🥉" : entry.rank}
                      </span>
                      <span className="flex-1 font-medium">{entry.displayName}{entry.userId === session.id && <span className="ml-1.5 text-xs text-gray-400">(du)</span>}</span>
                      <span className="font-bold text-green-600 dark:text-green-400">{entry.points} p</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {upcomingMatches.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Kommande matcher</h2>
                <div className="space-y-2">
                  {upcomingMatches.map((m) => (
                    <Link
                      key={m.id}
                      href={`/tournament/${tournament.id}/group`}
                      className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl px-4 py-3 flex items-center gap-3 text-sm hover:border-green-300 dark:hover:border-green-700 transition-colors"
                    >
                      <span className="text-gray-400 text-xs w-20 shrink-0">
                        {new Date(m.startsAt).toLocaleDateString("sv-SE", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          timeZone: "Europe/Stockholm",
                        })}
                        {" "}
                        {new Date(m.startsAt).toLocaleTimeString("sv-SE", {
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "Europe/Stockholm",
                        })}
                      </span>
                      <span className="flex-1 flex items-center justify-center gap-2 font-medium">
                        <span className="flex items-center gap-1.5">
                          <CountryFlag code={m.homeTeam?.countryCode} size={20} />
                          {m.homeTeam?.name ?? "–"}
                        </span>
                        <span className="text-gray-400 font-normal">vs</span>
                        <span className="flex items-center gap-1.5">
                          {m.awayTeam?.name ?? "–"}
                          <CountryFlag code={m.awayTeam?.countryCode} size={20} />
                        </span>
                      </span>
                      <span className="flex items-center justify-end w-12 shrink-0">
                        {m.broadcastChannel && (
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${m.broadcastChannel === "SVT" ? "bg-blue-600 text-white" : m.broadcastChannel === "TV4" ? "bg-red-600 text-white" : "bg-gray-200 text-gray-700"}`}>
                            {m.broadcastChannel}
                          </span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {claudeTip && (
              <div className="mt-8">
                <h2 className="text-lg font-semibold mb-3">🤖 Claudes tips</h2>
                <div className="bg-white dark:bg-gray-900 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">
                      {new Date(claudeTip.startsAt).toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/Stockholm" })}
                      {" "}
                      {new Date(claudeTip.startsAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Stockholm" })}
                    </span>
                    {claudeStats.total > 0 && (
                      <span className="text-xs text-gray-400">
                        {claudeStats.points}p · {claudeStats.exact} exakta · {claudeStats.outcome} rätt utfall
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-center gap-3 my-3">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <CountryFlag code={claudeTip.homeCode} size={20} />
                      {claudeTip.homeTeam}
                    </span>
                    <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                      {claudeTip.homeScore}–{claudeTip.awayScore}
                    </span>
                    <span className="flex items-center gap-1.5 font-semibold">
                      {claudeTip.awayTeam}
                      <CountryFlag code={claudeTip.awayCode} size={20} />
                    </span>
                  </div>
                  {claudeTip.analysis && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 italic border-t border-gray-100 dark:border-gray-800 pt-2 mt-2">
                      "{claudeTip.analysis}"
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
      <footer className="max-w-4xl mx-auto px-4 py-6 w-full text-center">
        <p className="text-xs text-gray-400">
          Hittat en bugg eller har ett förslag?{" "}
          <a href="mailto:joakim.frodin@gmail.com" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            Kontakta Joakim
          </a>
        </p>
      </footer>
    </>
  );
}
