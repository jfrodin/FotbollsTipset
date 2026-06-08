"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Tournament {
  id: string;
  name: string;
  year: number;
  status: string;
  apiProvider: string | null;
  externalId: string | null;
}

interface User {
  id: string;
  email: string;
  displayName: string;
  role: string;
  hasPaid: boolean;
  createdAt: Date;
  predictionCount: number;
}

interface SyncLog {
  id: string;
  tournamentId: string | null;
  provider: string | null;
  status: string;
  message: string | null;
  matchesUpdated: number | null;
  predictionsScored: number | null;
  startedAt: Date;
  finishedAt: Date | null;
}

interface Props {
  tournaments: Tournament[];
  users: User[];
  syncLogs: SyncLog[];
}

type Tab = "tournaments" | "users" | "sync" | "mail";

export function AdminPanel({ tournaments, users, syncLogs }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("tournaments");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [sending, setSending] = useState(false);
  const [mailResult, setMailResult] = useState<string | null>(null);

  async function triggerSync(tournamentId: string) {
    setSyncing(tournamentId);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId }),
      });
      const data = await res.json();
      setSyncResult(
        res.ok
          ? `✓ Synkad: ${data.matchesUpdated} matcher, ${data.predictionsScored} tips poängsatta`
          : `✗ Fel: ${data.error}`
      );
      router.refresh();
    } catch {
      setSyncResult("✗ Nätverksfel");
    } finally {
      setSyncing(null);
    }
  }

  async function updateTournamentStatus(id: string, status: string) {
    await fetch(`/api/admin/tournaments/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function updateUserRole(id: string, role: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    router.refresh();
  }

  async function togglePaid(id: string, hasPaid: boolean) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasPaid: !hasPaid }),
    });
    router.refresh();
  }

  async function deleteUser(id: string, name: string) {
    if (!confirm(`Ta bort ${name}? Detta går inte att ångra.`)) return;
    setDeletingUser(id);
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    setDeletingUser(null);
    router.refresh();
  }

  async function sendMail() {
    setSending(true);
    setMailResult(null);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: mailSubject, body: mailBody }),
      });
      const data = await res.json();
      setMailResult(res.ok ? `✓ Skickat till ${data.sent} användare` : `✗ ${data.error}`);
      if (res.ok) { setMailSubject(""); setMailBody(""); }
    } catch {
      setMailResult("✗ Nätverksfel");
    } finally {
      setSending(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "tournaments", label: "Turneringar" },
    { id: "users", label: `Användare (${users.length})` },
    { id: "sync", label: "Sync-loggar" },
    { id: "mail", label: "Skicka mail" },
  ];

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-green-600 text-green-600 dark:text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tournaments */}
      {tab === "tournaments" && (
        <div className="space-y-4">
          {syncResult && (
            <div className={`p-3 rounded-lg text-sm ${syncResult.startsWith("✓") ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"}`}>
              {syncResult}
            </div>
          )}

          {tournaments.length === 0 ? (
            <p className="text-gray-400 text-sm">Inga turneringar skapade ännu.</p>
          ) : (
            tournaments.map((t) => (
              <div key={t.id} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{t.name} {t.year}</h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Status: <span className="font-medium">{t.status}</span>
                      {t.apiProvider && ` · ${t.apiProvider} #${t.externalId}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={t.status}
                      onChange={(e) => updateTournamentStatus(t.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                    >
                      {["draft", "open", "active", "finished"].map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => triggerSync(t.id)}
                      disabled={syncing === t.id}
                      className="px-3 py-1 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium disabled:opacity-50 transition-colors"
                    >
                      {syncing === t.id ? "Synkar…" : "Synka nu"}
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Users */}
      {tab === "users" && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3">Namn</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">E-post</th>
                <th className="text-left px-4 py-3">Roll</th>
                <th className="text-right px-4 py-3 hidden sm:table-cell">Tips</th>
                <th className="text-center px-4 py-3">Betalt</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Registrerad</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium">{u.displayName}</td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateUserRole(u.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"
                    >
                      <option value="player">player</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-sm hidden sm:table-cell">
                    {u.predictionCount}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePaid(u.id, u.hasPaid)}
                      className={`text-lg transition-opacity hover:opacity-70`}
                      title={u.hasPaid ? "Markera som ej betalt" : "Markera som betalt"}
                    >
                      {u.hasPaid ? "✅" : "⬜"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                    {new Date(u.createdAt).toLocaleDateString("sv-SE")}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => deleteUser(u.id, u.displayName)}
                      disabled={deletingUser === u.id}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-40"
                    >
                      Ta bort
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mail */}
      {tab === "mail" && (
        <div className="space-y-4">
          {mailResult && (
            <div className={`p-3 rounded-lg text-sm ${mailResult.startsWith("✓") ? "bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"}`}>
              {mailResult}
            </div>
          )}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ämne</label>
              <input
                type="text"
                value={mailSubject}
                onChange={(e) => setMailSubject(e.target.value)}
                placeholder="Ämnesrad"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meddelande</label>
              <textarea
                value={mailBody}
                onChange={(e) => setMailBody(e.target.value)}
                placeholder="Skriv ditt meddelande här..."
                rows={6}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">Skickas till alla {users.length} användare</span>
              <button
                onClick={sendMail}
                disabled={sending || !mailSubject.trim() || !mailBody.trim()}
                className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium disabled:opacity-50 transition-colors"
              >
                {sending ? "Skickar…" : "Skicka till alla"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sync Logs */}
      {tab === "sync" && (
        <div className="space-y-2">
          {syncLogs.length === 0 ? (
            <p className="text-gray-400 text-sm">Inga sync-loggar ännu.</p>
          ) : (
            syncLogs.map((log) => (
              <div
                key={log.id}
                className={`bg-white dark:bg-gray-900 border rounded-xl px-4 py-3 text-sm ${
                  log.status === "success"
                    ? "border-green-200 dark:border-green-800"
                    : log.status === "error"
                    ? "border-red-200 dark:border-red-800"
                    : "border-gray-200 dark:border-gray-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${log.status === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                      {log.status === "success" ? "✓" : "✗"} {log.provider ?? "unknown"}
                    </span>
                    {log.matchesUpdated != null && log.matchesUpdated > 0 && (
                      <span className="text-gray-500">{log.matchesUpdated} matcher</span>
                    )}
                    {log.predictionsScored != null && log.predictionsScored > 0 && (
                      <span className="text-gray-500">{log.predictionsScored} tips</span>
                    )}
                  </div>
                  <span className="text-gray-400 text-xs">
                    {new Date(log.startedAt).toLocaleString("sv-SE")}
                  </span>
                </div>
                {log.message && (
                  <p className="text-gray-500 text-xs mt-1 font-mono">{log.message}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
