import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";

export default async function RulesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <>
      <Navbar user={session} />
      <main className="max-w-2xl mx-auto px-4 py-8 w-full flex-1">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/" className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-sm">
            ← Hem
          </Link>
          <span className="text-gray-300 dark:text-gray-600">/</span>
          <h1 className="text-xl font-bold">Hur funkar det?</h1>
        </div>

        <div className="space-y-6">

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">Poängsystem</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <span className="text-2xl">🎯</span>
                <div>
                  <p className="font-medium">Exakt rätt resultat – 5 poäng</p>
                  <p className="text-sm text-gray-500 mt-0.5">Du tippar exakt rätt poäng, t.ex. 2–1 och det slutar 2–1.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-2xl">⚽</span>
                <div>
                  <p className="font-medium">Rätt utfall – 2 poäng</p>
                  <p className="text-sm text-gray-500 mt-0.5">Du tippar rätt vinnare eller oavgjort, men fel antal mål. T.ex. du tippar 3–1 och det slutar 2–0.</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-2xl">❌</span>
                <div>
                  <p className="font-medium">Fel – 0 poäng</p>
                  <p className="text-sm text-gray-500 mt-0.5">Du tippar fel utfall, t.ex. vinst men matchen slutar oavgjort.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">Regler</h2>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">🔒</span>
                <p>Tippning stänger automatiskt när matchen startar. Du kan inte tippa eller ändra ditt tips efter att matchen har börjat.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">✏️</span>
                <p>Du kan ändra ditt tips hur många gånger som helst fram tills matchen startar.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">📊</span>
                <p>Poäng räknas ut automatiskt när matchresultatet är klart.</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-amber-200 dark:border-amber-800 rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">Deltagaravgift</h2>
            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">💸</span>
                <p>Det kostar <strong className="text-gray-800 dark:text-gray-200">50 kr</strong> att delta. Vinnaren tar hem hela potten.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">📱</span>
                <div>
                  <p>Swisha <strong className="text-gray-800 dark:text-gray-200">076-834 49 25</strong></p>
                  <p className="mt-0.5">Skriv <strong className="text-gray-800 dark:text-gray-200">Fotbollstipset</strong> som meddelande.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="text-base mt-0.5">⏰</span>
                <p>Swisha när du vill – alla som är med swishar vinnaren när turneringen är klar.</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h2 className="font-semibold text-lg mb-4">Vid lika poäng</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Om flera spelare har samma poäng avgörs placeringen i denna ordning:</p>
            <ol className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs flex items-center justify-center font-bold">1</span> Flest exakta resultat</li>
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs flex items-center justify-center font-bold">2</span> Flest rätt utfall</li>
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs flex items-center justify-center font-bold">3</span> Färst tippade matcher</li>
              <li className="flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs flex items-center justify-center font-bold">4</span> Alfabetisk ordning</li>
            </ol>
          </div>

        </div>
      </main>
    </>
  );
}
