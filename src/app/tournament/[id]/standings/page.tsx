import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { db } from "@/db";
import { tournaments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fetchStandings } from "@/lib/football-api/api-football";
import { toSwedish } from "@/lib/team-names";

function toSwedishGroup(name: string, size?: number): string {
  if (!name) return name;
  // Bästa treor identifieras enbart på storlek (12 lag i VM 2026) eller om "third" finns i namnet
  if (size && size > 6) return "Bästa grupptreor";
  const lower = name.toLowerCase();
  if (lower.includes("third") || lower.includes("3rd")) return "Bästa grupptreor";
  // "Group Stage - Group A" → "Grupp A"
  const stageMatch = name.match(/Group Stage\s*-\s*Group\s+(\w+)/i);
  if (stageMatch) return `Grupp ${stageMatch[1]}`;
  // "Group A" → "Grupp A"
  return name.replace(/^Group\s+/i, "Grupp ");
}

function isThirdPlacedGroup(name: string, size: number): boolean {
  if (size > 6) return true;
  return name.toLowerCase().includes("third") || name.toLowerCase().includes("3rd");
}
import Image from "next/image";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function StandingsPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: tournamentId } = await params;

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.id, tournamentId))
    .limit(1);

  if (!tournament) redirect("/");

  let groups: { name: string; entries: Awaited<ReturnType<typeof fetchStandings>>[0]["league"]["standings"][0] }[] = [];
  let error = false;

  if (tournament.externalId && tournament.apiProvider) {
    try {
      const data = await fetchStandings(tournament.externalId, tournament.year);
      const standings = data[0]?.league?.standings ?? [];
      groups = standings
        .filter((group) => group.length > 0)
        .map((group) => ({
          name: group[0]?.group ?? group[0]?.description ?? `Grupp ${group[0]?.rank ?? ""}`,
          entries: group,
        }));
    } catch {
      error = true;
    }
  }

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
            ← Hem
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h1 className="text-xl font-bold">Gruppställningar</h1>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 text-sm text-red-600 dark:text-red-400">
            Kunde inte hämta ställningar just nu. Försök igen senare.
          </div>
        )}

        {!error && groups.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">📊</div>
            <p className="font-medium text-gray-600 dark:text-gray-300">Inga ställningar tillgängliga än.</p>
            <p className="text-sm mt-1">Visas här när turneringen har startat.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {groups.map((group) => (
            <div key={group.name} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {toSwedishGroup(group.name, group.entries.length)}
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                    <th className="text-left px-3 py-1.5 w-6">#</th>
                    <th className="text-left px-3 py-1.5">Lag</th>
                    <th className="text-center px-2 py-1.5">S</th>
                    <th className="text-center px-2 py-1.5">V</th>
                    <th className="text-center px-2 py-1.5">O</th>
                    <th className="text-center px-2 py-1.5">F</th>
                    <th className="text-center px-2 py-1.5 hidden sm:table-cell">GM</th>
                    <th className="text-center px-2 py-1.5 hidden sm:table-cell">IM</th>
                    <th className="text-center px-2 py-1.5">+/-</th>
                    <th className="text-right px-3 py-1.5 font-bold text-gray-500">P</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                  {group.entries.map((entry, idx) => (
                    <tr key={entry.team.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${isThirdPlacedGroup(group.name, group.entries.length) && idx === 7 ? "border-b-2 border-green-400 dark:border-green-600" : ""}`}>
                      <td className="px-3 py-2 text-gray-400 text-xs">{entry.rank}</td>
                      <td className="px-3 py-2">
                        <span className="flex items-center gap-2">
                          <Image src={entry.team.logo} alt={entry.team.name} width={16} height={16} unoptimized />
                          <span className="font-medium truncate">{toSwedish(entry.team.name)}</span>
                        </span>
                      </td>
                      <td className="text-center px-2 py-2 text-gray-500">{entry.all.played}</td>
                      <td className="text-center px-2 py-2 text-gray-500">{entry.all.win}</td>
                      <td className="text-center px-2 py-2 text-gray-500">{entry.all.draw}</td>
                      <td className="text-center px-2 py-2 text-gray-500">{entry.all.lose}</td>
                      <td className="text-center px-2 py-2 text-gray-500 hidden sm:table-cell">{entry.all.goals.for}</td>
                      <td className="text-center px-2 py-2 text-gray-500 hidden sm:table-cell">{entry.all.goals.against}</td>
                      <td className={`text-center px-2 py-2 font-medium ${entry.goalsDiff > 0 ? "text-green-600 dark:text-green-400" : entry.goalsDiff < 0 ? "text-red-500" : "text-gray-500"}`}>{entry.goalsDiff > 0 ? `+${entry.goalsDiff}` : entry.goalsDiff}</td>
                      <td className="text-right px-3 py-2 font-bold">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </main>
    </>
  );
}
