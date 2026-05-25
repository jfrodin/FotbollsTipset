import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { db } from "@/db";
import { phases, tournaments, predictions, users, matches } from "@/db/schema";
import { eq, and, sum, count, sql } from "drizzle-orm";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ phaseId?: string }>;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  totalPoints: number;
  exactScores: number;
  correctOutcomes: number;
  predictionsCount: number;
}

async function getLeaderboard(tournamentId: string, phaseId?: string): Promise<LeaderboardEntry[]> {
  const conditions = [eq(predictions.tournamentId, tournamentId)];

  if (phaseId) {
    const phaseMatchIds = await db
      .select({ id: matches.id })
      .from(matches)
      .where(and(eq(matches.phaseId, phaseId), eq(matches.tournamentId, tournamentId)));

    const ids = phaseMatchIds.map((m) => m.id);
    if (ids.length === 0) return [];

    conditions.push(sql`${predictions.matchId} = ANY(ARRAY[${sql.join(ids.map((id) => sql`${id}`), sql`, `)}]::text[])`);
  }

  const rows = await db
    .select({
      userId: predictions.userId,
      displayName: users.displayName,
      totalPoints: sum(predictions.points).mapWith(Number),
      exactScores: count(sql`CASE WHEN ${predictions.isExactScore} = true THEN 1 END`).mapWith(Number),
      correctOutcomes: count(sql`CASE WHEN ${predictions.isCorrectOutcome} = true THEN 1 END`).mapWith(Number),
      predictionsCount: count(predictions.id).mapWith(Number),
    })
    .from(predictions)
    .innerJoin(users, eq(predictions.userId, users.id))
    .where(and(...conditions))
    .groupBy(predictions.userId, users.displayName);

  const sorted = rows.sort((a, b) => {
    if ((b.totalPoints ?? 0) !== (a.totalPoints ?? 0)) return (b.totalPoints ?? 0) - (a.totalPoints ?? 0);
    if (b.exactScores !== a.exactScores) return b.exactScores - a.exactScores;
    if (b.correctOutcomes !== a.correctOutcomes) return b.correctOutcomes - a.correctOutcomes;
    if (a.predictionsCount !== b.predictionsCount) return a.predictionsCount - b.predictionsCount;
    return a.displayName.localeCompare(b.displayName);
  });

  return sorted.map((row, idx) => ({
    rank: idx + 1,
    userId: row.userId,
    displayName: row.displayName,
    totalPoints: row.totalPoints ?? 0,
    exactScores: row.exactScores,
    correctOutcomes: row.correctOutcomes,
    predictionsCount: row.predictionsCount,
  }));
}

export default async function LeaderboardPage({ params, searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: tournamentId } = await params;
  const { phaseId } = await searchParams;

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  const tournamentPhases = await db
    .select()
    .from(phases)
    .where(eq(phases.tournamentId, tournamentId))
    .orderBy(phases.startsAt);

  const entries = await getLeaderboard(tournamentId, phaseId);
  const userEntry = entries.find((e) => e.userId === session.id);

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
            ← Hem
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h1 className="text-xl font-bold">Tabell</h1>
        </div>

        {/* Phase filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Link
            href={`/tournament/${tournamentId}/leaderboard`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              !phaseId
                ? "bg-green-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            Totalt
          </Link>
          {tournamentPhases.map((p) => (
            <Link
              key={p.id}
              href={`/tournament/${tournamentId}/leaderboard?phaseId=${p.id}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                phaseId === p.id
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {p.name}
            </Link>
          ))}
        </div>

        {/* Your position */}
        {userEntry && (
          <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3 mb-6 flex items-center justify-between">
            <div>
              <span className="text-sm text-green-700 dark:text-green-400 font-medium">
                Din placering: #{userEntry.rank}
              </span>
              <span className="text-sm text-green-600 dark:text-green-500 ml-3">
                {userEntry.totalPoints} poäng
              </span>
            </div>
            <span className="text-xs text-green-600 dark:text-green-500">
              {userEntry.exactScores} exakta · {userEntry.correctOutcomes} rätt utfall
            </span>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left px-4 py-3 w-12">#</th>
                <th className="text-left px-4 py-3">Namn</th>
                <th className="text-right px-4 py-3 hidden md:table-cell">Tippade</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Rätt utfall</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Exakt resultat</th>
                <th className="text-right px-4 py-3">Poäng</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
                    Inga resultat än.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr
                    key={entry.userId}
                    className={`${
                      entry.userId === session.id
                        ? "bg-green-50 dark:bg-green-950/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    } transition-colors`}
                  >
                    <td className="px-4 py-3 font-bold text-gray-500">
                      {entry.rank <= 3 ? ["🥇", "🥈", "🥉"][entry.rank - 1] : entry.rank}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {entry.displayName}
                      {entry.userId === session.id && (
                        <span className="ml-2 text-xs text-gray-400">(du)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                      {entry.predictionsCount}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                      {entry.correctOutcomes}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">
                      {entry.exactScores}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{entry.totalPoints}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Vid lika poäng avgörs placeringen av flest exakta resultat, sedan flest rätt utfall, sedan färst tippade matcher.
        </p>
      </main>
    </>
  );
}
