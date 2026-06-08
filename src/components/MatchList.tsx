"use client";

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("sv-SE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Stockholm",
  });
}

export function MatchList({ matches, groupByDate = true }: MatchListProps) {
  if (matches.length === 0) {
    return (
      <p className="text-center text-gray-400 py-12">Inga matcher att visa.</p>
    );
  }

  if (!groupByDate) {
    return (
      <div className="space-y-3">
        {matches.map((m) => (
          <PredictionInput key={m.id} match={m} />
        ))}
      </div>
    );
  }

  const byDate = new Map<string, Match[]>();
  for (const match of matches) {
    const date = new Date(match.startsAt).toLocaleDateString("sv-SE", {
      timeZone: "Europe/Stockholm",
    });
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(match);
  }

  return (
    <div className="space-y-8">
      {Array.from(byDate.entries()).map(([date, dayMatches]) => (
        <div key={date}>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3 capitalize">
            {formatDate(dayMatches[0].startsAt)}
          </h3>
          <div className="space-y-3">
            {dayMatches.map((m) => (
              <PredictionInput key={m.id} match={m} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
