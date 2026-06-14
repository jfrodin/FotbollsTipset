"use client";

import { useState } from "react";
import { PredictionInput } from "./PredictionInput";

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
  venue: string | null;
  broadcastChannel: string | null;
  phaseName: string | null;
  phaseType: string | null;
}

interface MatchListProps {
  matches: Match[];
  groupByDate?: boolean;
}

function toDateKey(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Stockholm" });
}

function formatTabLabel(dateKey: string): string {
  const today = toDateKey(new Date().toISOString());
  const tomorrow = toDateKey(new Date(Date.now() + 86400000).toISOString());
  if (dateKey === today) return "Idag";
  if (dateKey === tomorrow) return "Imorgon";
  const d = new Date(dateKey);
  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "numeric" });
}

function defaultDate(byDate: Map<string, Match[]>): string {
  const today = toDateKey(new Date().toISOString());
  // Prefer today if it exists
  if (byDate.has(today)) return today;
  // Otherwise first upcoming date
  const dates = Array.from(byDate.keys());
  const future = dates.find((d) => d >= today);
  return future ?? dates[dates.length - 1];
}

export function MatchList({ matches, groupByDate = true }: MatchListProps) {
  const byDate = new Map<string, Match[]>();
  for (const match of matches) {
    const key = toDateKey(match.startsAt);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key)!.push(match);
  }

  const [selectedDate, setSelectedDate] = useState(() => defaultDate(byDate));

  if (matches.length === 0) {
    return <p className="text-center text-gray-400 py-12">Inga matcher att visa.</p>;
  }

  if (!groupByDate) {
    return (
      <div className="space-y-3">
        {matches.map((m) => <PredictionInput key={m.id} match={m} />)}
      </div>
    );
  }

  const dates = Array.from(byDate.keys());
  const dayMatches = byDate.get(selectedDate) ?? [];

  return (
    <div>
      {/* Day tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 scrollbar-hide">
        {dates.map((date) => {
          const isSelected = date === selectedDate;
          const today = toDateKey(new Date().toISOString());
          const isPast = date < today;
          return (
            <button
              key={date}
              onClick={() => setSelectedDate(date)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isSelected
                  ? "bg-green-600 text-white"
                  : isPast
                  ? "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {formatTabLabel(date)}
            </button>
          );
        })}
      </div>

      {/* Matches for selected day */}
      <div className="space-y-3">
        {dayMatches.map((m) => <PredictionInput key={m.id} match={m} />)}
      </div>
    </div>
  );
}
