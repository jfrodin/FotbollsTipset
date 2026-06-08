"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function TermsModal() {
  const [accepting, setAccepting] = useState(false);
  const router = useRouter();

  async function accept() {
    setAccepting(true);
    await fetch("/api/user/accept-terms", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="text-3xl mb-3">⚽</div>
        <h2 className="text-xl font-bold mb-1">Välkommen till FotbollsTipset!</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Innan du börjar tippa – ett par saker att känna till:</p>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-3 text-sm">
            <span className="text-base">💸</span>
            <p>Det kostar <strong>50 kr</strong> att delta. När turneringen är klar swishar alla deltagare 50 kr till vinnaren.</p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <span className="text-base">📱</span>
            <p>Swisha till <strong>076-834 49 25</strong>, skriv <strong>Fotbollstipset</strong>.</p>
          </div>
          <div className="flex items-start gap-3 text-sm">
            <span className="text-base">🔒</span>
            <p>Du kan tippa fram tills matchen startar – inte efter.</p>
          </div>
        </div>

        <button
          onClick={accept}
          disabled={accepting}
          className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors disabled:opacity-50"
        >
          {accepting ? "Sparar…" : "Jag förstår – kör igång!"}
        </button>
      </div>
    </div>
  );
}
