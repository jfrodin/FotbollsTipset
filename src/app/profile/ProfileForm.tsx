"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  displayName: string;
  email: string;
}

export function ProfileForm({ displayName, email }: Props) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    setError(null);
    const res = await fetch("/api/user/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: name }),
    });
    setLoading(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    } else {
      setError((await res.json()).error ?? "Något gick fel");
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          Visningsnamn
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); setSaved(false); }}
          maxLength={30}
          required
          autoFocus
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
        />
        <p className="text-xs text-gray-400 mt-1">{name.length}/30 tecken</p>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
          E-post
        </label>
        <input
          type="text"
          value={email}
          disabled
          className="w-full px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 text-gray-400 text-sm cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">E-postadressen kan inte ändras</p>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !name.trim() || name === displayName}
          className="px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
        >
          {loading ? "Sparar…" : "Spara"}
        </button>
        {saved && <span className="text-sm text-green-600 dark:text-green-400">✓ Sparat</span>}
      </div>
    </form>
  );
}
