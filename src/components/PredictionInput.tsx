"use client";

import { useState, useOptimistic, useTransition } from "react";

interface Match {
  id: string;
  tournamentId: string;
  homeTeam: { name: string; shortName: string | null; logoUrl: string | null; countryCode: string | null } | null;
  awayTeam: { name: string; shortName: string | null; logoUrl: string | null; countryCode: string | null } | null;
  startsAt: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  userPrediction: {
    predictedHomeScore: number;
    predictedAwayScore: number;
    points: number | null;
  } | null;
  groupName: string | null;
  roundName: string | null;
}

interface PredictionInputProps {
  match: Match;
}

function ScoreButton({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
        aria-label="Minska"
      >
        −
      </button>
      <span className="w-8 text-center text-xl font-bold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(99, value + 1))}
        disabled={disabled}
        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
        aria-label="Öka"
      >
        +
      </button>
    </div>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("sv-SE", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Stockholm",
  });
}

function countryFlag(code: string | null): string {
  if (!code) return "";
  if (code === "GB-ENG") return "🏴󠁧󠁢󠁥󠁮󠁧󠁿";
  if (code === "GB-SCT") return "🏴󠁧󠁢󠁳󠁣󠁴󠁿";
  return [...code.toUpperCase()].map((c) =>
    String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65)
  ).join("");
}

function matchIsLocked(match: Match): boolean {
  return (
    new Date() >= new Date(match.startsAt) ||
    ["live", "finished", "cancelled"].includes(match.status)
  );
}

function statusBadge(match: Match) {
  if (match.status === "live") {
    return <span className="text-xs font-semibold text-red-500 animate-pulse">LIVE</span>;
  }
  if (match.status === "finished") {
    return <span className="text-xs text-gray-500">Avslutad</span>;
  }
  if (match.status === "postponed") {
    return <span className="text-xs text-yellow-500">Uppskjuten</span>;
  }
  return null;
}

export function PredictionInput({ match }: PredictionInputProps) {
  const locked = matchIsLocked(match);
  const [homeScore, setHomeScore] = useState(match.userPrediction?.predictedHomeScore ?? 0);
  const [awayScore, setAwayScore] = useState(match.userPrediction?.predictedAwayScore ?? 0);
  const [saved, setSaved] = useState(!!match.userPrediction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          tournamentId: match.tournamentId,
          predictedHomeScore: homeScore,
          predictedAwayScore: awayScore,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Fel vid sparande");
      } else {
        setSaved(true);
      }
    } catch {
      setError("Nätverksfel");
    } finally {
      setSaving(false);
    }
  }

  const homeName = match.homeTeam?.name ?? "?";
  const awayName = match.awayTeam?.name ?? "?";
  const homeFlag = countryFlag(match.homeTeam?.countryCode ?? null);
  const awayFlag = countryFlag(match.awayTeam?.countryCode ?? null);

  const changed =
    match.userPrediction?.predictedHomeScore !== homeScore ||
    match.userPrediction?.predictedAwayScore !== awayScore;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-400">
          {match.groupName ?? match.roundName ?? ""}
        </span>
        <div className="flex items-center gap-2">
          {statusBadge(match)}
          <span className="text-xs text-gray-400">{formatTime(match.startsAt)}</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Home team */}
        <div className="flex-1 flex items-center justify-end gap-3">
          {homeFlag && <span className="text-2xl leading-none">{homeFlag}</span>}
          <span className="font-semibold text-sm">{homeName}</span>
        </div>

        {/* Score / prediction */}
        <div className="flex items-center gap-2 shrink-0">
          {match.status === "finished" || match.status === "live" ? (
            <div className="text-center">
              <div className="text-lg font-bold">
                {match.homeScore ?? "–"} – {match.awayScore ?? "–"}
              </div>
              {match.userPrediction && (
                <div className="text-xs text-gray-400 mt-0.5">
                  Tip: {match.userPrediction.predictedHomeScore}–{match.userPrediction.predictedAwayScore}
                  {match.userPrediction.points !== null && (
                    <span className="ml-1 font-semibold text-green-600 dark:text-green-400">
                      {match.userPrediction.points}p
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : locked ? (
            <div className="text-center text-sm text-gray-400">
              {match.userPrediction
                ? `${match.userPrediction.predictedHomeScore} – ${match.userPrediction.predictedAwayScore}`
                : "Ej tippat"}
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <ScoreButton value={homeScore} onChange={setHomeScore} disabled={locked || saving} />
              <span className="font-bold text-gray-400 mx-1">–</span>
              <ScoreButton value={awayScore} onChange={setAwayScore} disabled={locked || saving} />
            </div>
          )}
        </div>

        {/* Away team */}
        <div className="flex-1 flex items-center gap-3">
          <span className="font-semibold text-sm">{awayName}</span>
          {awayFlag && <span className="text-2xl leading-none">{awayFlag}</span>}
        </div>
      </div>

      {!locked && (
        <div className="mt-3 flex items-center justify-between">
          {error && <span className="text-xs text-red-500">{error}</span>}
          <div className="ml-auto">
            {saved && !changed ? (
              <span className="text-xs text-green-600 dark:text-green-400">✓ Sparat</span>
            ) : (
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                {saving ? "Sparar…" : saved ? "Uppdatera" : "Spara"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
