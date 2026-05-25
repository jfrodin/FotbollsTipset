import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import { MatchList } from "@/components/MatchList";
import Link from "next/link";

interface Props {
  params: Promise<{ id: string }>;
}

async function getMatches(tournamentId: string) {
  const res = await fetch(
    `${process.env.APP_URL ?? "http://localhost:3000"}/api/tournaments/${tournamentId}/matches`,
    { cache: "no-store" }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data as Array<{ phaseType: string; [k: string]: unknown }>).filter(
    (m) => m.phaseType === "knockout"
  );
}

export default async function KnockoutPage({ params }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id: tournamentId } = await params;
  const matches = await getMatches(tournamentId);

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-4xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
            ← Hem
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h1 className="text-xl font-bold">Slutspel</h1>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🏆</div>
            <p className="font-medium text-gray-600 dark:text-gray-300">Slutspelet är inte startat än.</p>
            <p className="text-sm mt-1">Matcherna visas här när de är kända.</p>
          </div>
        ) : (
          <MatchList matches={matches as unknown as Parameters<typeof MatchList>[0]["matches"]} />
        )}
      </main>
    </>
  );
}
