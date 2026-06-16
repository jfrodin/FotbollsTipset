"use client";

import { useState } from "react";
import { CountryFlag } from "./CountryFlag";

interface OtherPrediction {
  userId: string;
  displayName: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  points: number | null;
}

interface MatchEvent {
  time: { elapsed: number; extra: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist: { id: number | null; name: string | null };
  type: string;
  detail: string;
  side: "home" | "away" | null;
  countryCode: string | null;
  score: { home: number; away: number } | null;
}

interface Match {
  id: string;
  tournamentId: string;
  externalId: string | null;
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
  venue: string | null;
  broadcastChannel: string | null;
}

const CHANNEL_STYLES: Record<string, string> = {
  "SVT": "bg-blue-600 text-white",
  "TV4": "bg-red-600 text-white",
};

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
        onClick={() => onChange(Math.min(99, value + 1))}
        disabled={disabled}
        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
        aria-label="Öka"
      >
        +
      </button>
      <span className="w-8 text-center text-xl font-bold tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        disabled={disabled || value <= 0}
        className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-lg font-bold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-30 transition-colors"
        aria-label="Minska"
      >
        −
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
  const [savedHome, setSavedHome] = useState(match.userPrediction?.predictedHomeScore ?? null);
  const [savedAway, setSavedAway] = useState(match.userPrediction?.predictedAwayScore ?? null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOthers, setShowOthers] = useState(false);
  const [others, setOthers] = useState<OtherPrediction[] | null>(null);
  const [loadingOthers, setLoadingOthers] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [events, setEvents] = useState<MatchEvent[] | null>(null);
  const [loadingEvents, setLoadingEvents] = useState(false);

  async function toggleOthers() {
    if (showOthers) { setShowOthers(false); return; }
    if (others !== null) { setShowOthers(true); return; }
    setLoadingOthers(true);
    try {
      const res = await fetch(`/api/matches/${match.id}/predictions`);
      if (res.ok) setOthers(await res.json());
    } finally {
      setLoadingOthers(false);
      setShowOthers(true);
    }
  }

  async function toggleEvents() {
    if (showEvents) { setShowEvents(false); return; }
    if (events !== null) { setShowEvents(true); return; }
    setLoadingEvents(true);
    try {
      const res = await fetch(`/api/matches/${match.id}/events`);
      if (res.ok) setEvents(await res.json());
    } finally {
      setLoadingEvents(false);
      setShowEvents(true);
    }
  }

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
        setSavedHome(homeScore);
        setSavedAway(awayScore);
      }
    } catch {
      setError("Nätverksfel");
    } finally {
      setSaving(false);
    }
  }

  const homeName = match.homeTeam?.name ?? "?";
  const awayName = match.awayTeam?.name ?? "?";

  const saved = savedHome !== null;
  const changed = savedHome !== homeScore || savedAway !== awayScore;

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-xs text-gray-400">{match.groupName ?? match.roundName ?? ""}</span>
          {match.venue && (
            <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">📍 {match.venue}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {statusBadge(match)}
          {match.broadcastChannel && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${CHANNEL_STYLES[match.broadcastChannel] ?? "bg-gray-200 text-gray-700"}`}>
              {match.broadcastChannel}
            </span>
          )}
          <span className="text-xs text-gray-400">{formatTime(match.startsAt)}</span>
        </div>
      </div>

      {/* Mobile: vertical stack. Desktop: horizontal row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">

        {/* Finished/live: show result centered (same on all screen sizes) */}
        {match.status === "finished" || match.status === "live" ? (
          <div className="w-full">
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center justify-end gap-2">
                <CountryFlag code={match.homeTeam?.countryCode} size={24} />
                <span className="font-semibold text-sm">{homeName}</span>
              </div>
              <div className="text-lg font-bold shrink-0 text-center">
                {match.homeScore ?? "–"} – {match.awayScore ?? "–"}
              </div>
              <div className="flex-1 flex items-center gap-2">
                <span className="font-semibold text-sm">{awayName}</span>
                <CountryFlag code={match.awayTeam?.countryCode} size={24} />
              </div>
            </div>
            {match.userPrediction && (
              <div className="text-xs text-gray-400 mt-1.5 text-center">
                Ditt tips: {match.userPrediction.predictedHomeScore}–{match.userPrediction.predictedAwayScore}
                {match.userPrediction.points !== null && (
                  <span className="ml-1 font-semibold text-green-600 dark:text-green-400">
                    · {match.userPrediction.points}p
                  </span>
                )}
              </div>
            )}
          </div>
        ) : locked ? (
          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 flex items-center justify-end gap-2">
              <CountryFlag code={match.homeTeam?.countryCode} size={24} />
              <span className="font-semibold text-sm">{homeName}</span>
            </div>
            <div className="text-center text-sm text-gray-400 shrink-0">
              {match.userPrediction
                ? `${match.userPrediction.predictedHomeScore} – ${match.userPrediction.predictedAwayScore}`
                : "Ej tippat"}
            </div>
            <div className="flex-1 flex items-center gap-2">
              <span className="font-semibold text-sm">{awayName}</span>
              <CountryFlag code={match.awayTeam?.countryCode} size={24} />
            </div>
          </div>
        ) : (
          <>
            {/* Home team row */}
            <div className="flex items-center justify-between sm:flex-1 sm:justify-end sm:gap-2">
              <div className="flex items-center gap-2">
                <CountryFlag code={match.homeTeam?.countryCode} size={24} />
                <span className="font-semibold text-sm">{homeName}</span>
              </div>
              <div className="sm:hidden">
                <ScoreButton value={homeScore} onChange={setHomeScore} disabled={saving} />
              </div>
            </div>

            {/* Desktop center score */}
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              <ScoreButton value={homeScore} onChange={setHomeScore} disabled={saving} />
              <span className="font-bold text-gray-400 mx-1">–</span>
              <ScoreButton value={awayScore} onChange={setAwayScore} disabled={saving} />
            </div>

            {/* Away team row */}
            <div className="flex items-center justify-between sm:flex-1 sm:gap-2">
              <div className="flex items-center gap-2">
                <CountryFlag code={match.awayTeam?.countryCode} size={24} />
                <span className="font-semibold text-sm">{awayName}</span>
              </div>
              <div className="sm:hidden">
                <ScoreButton value={awayScore} onChange={setAwayScore} disabled={saving} />
              </div>
            </div>
          </>
        )}
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

      {locked && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-4">
            <button
              onClick={toggleOthers}
              className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              {loadingOthers ? "Laddar…" : showOthers ? "▲ Dölj tips" : "▼ Visa allas tips"}
            </button>
            {(match.status === "finished" || match.status === "live") && (
              <button
                onClick={toggleEvents}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                {loadingEvents ? "Laddar…" : showEvents ? "▲ Dölj händelser" : "▼ Mål & kort"}
              </button>
            )}
          </div>

          {showEvents && events && (
            <div className="mt-1 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
              {events.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-2">Inga händelser registrerade.</p>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {events.map((e, i) => {
                    const isGoal = e.type === "Goal";
                    const isOwnGoal = e.detail === "Own Goal";
                    const isPenalty = e.detail === "Penalty";
                    const isYellow = e.detail === "Yellow Card";
                    const isRed = e.detail === "Red Card" || e.detail === "Second Yellow card";
                    const icon = isGoal
                      ? isPenalty ? "⚽P" : isOwnGoal ? "⚽SG" : "⚽"
                      : isYellow ? "🟨" : isRed ? "🟥" : null;
                    if (!icon) return null;
                    const minute = e.time.extra ? `${e.time.elapsed}+${e.time.extra}'` : `${e.time.elapsed}'`;
                    const isHome = e.side === "home";
                    const isAway = e.side === "away";
                    return (
                      <div key={i} className="grid grid-cols-[1fr_auto_1fr] items-center gap-1 px-3 py-1.5 text-xs">
                        {/* Left: home team event */}
                        <div className={`flex items-center gap-1 min-w-0 ${isHome ? "" : "invisible"}`}>
                          {e.countryCode && <CountryFlag code={e.countryCode} size={14} />}
                          <span>{icon}</span>
                          <span className="truncate font-medium">{e.player.name ?? "–"}</span>
                        </div>
                        {/* Center: minute + score */}
                        <div className="flex flex-col items-center shrink-0 w-14">
                          <span className="text-gray-400 tabular-nums">{minute}</span>
                          {isGoal && e.score && (
                            <span className="font-bold text-green-600 dark:text-green-400 tabular-nums">
                              {e.score.home}–{e.score.away}
                            </span>
                          )}
                        </div>
                        {/* Right: away team event */}
                        <div className={`flex items-center gap-1 justify-end min-w-0 ${isAway ? "" : "invisible"}`}>
                          <span className="truncate font-medium">{e.player.name ?? "–"}</span>
                          <span>{icon}</span>
                          {e.countryCode && <CountryFlag code={e.countryCode} size={14} />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {showOthers && others && (
            <div className="mt-2 border border-gray-100 dark:border-gray-800 rounded-lg overflow-hidden">
              {others.length === 0 ? (
                <p className="text-xs text-gray-400 px-3 py-2">Ingen har tippat denna match.</p>
              ) : (
                <>
                  {/* Sammanfattning */}
                  {match.status === "finished" && (() => {
                    const total = others.length;
                    const exact = others.filter(o => o.points !== null && o.points >= 5).length;
                    const correct = others.filter(o => o.points !== null && o.points > 0).length;
                    return (
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 flex gap-3 flex-wrap">
                        <span>{total} tippade</span>
                        <span>⚽ Exakt: <strong className="text-gray-700 dark:text-gray-300">{Math.round(exact / total * 100)}%</strong></span>
                        <span>✓ Rätt utfall: <strong className="text-gray-700 dark:text-gray-300">{Math.round(correct / total * 100)}%</strong></span>
                      </div>
                    );
                  })()}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {others.map((o) => (
                      <div key={o.userId} className="flex items-center justify-between px-3 py-1.5 text-xs">
                        <span className="text-gray-600 dark:text-gray-400">{o.displayName}</span>
                        <span className="font-medium tabular-nums">
                          {o.predictedHomeScore}–{o.predictedAwayScore}
                          {o.points !== null && (
                            <span className="ml-1.5 text-green-600 dark:text-green-400 font-semibold">{o.points}p</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
