"use client";

import { useState } from "react";
import Image from "next/image";
import { toSwedish } from "@/lib/team-names";
import { Bracket, type BracketMatchData } from "./Bracket";

// ─── Types ───────────────────────────────────────────────────────────────────

interface StandingEntry {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string;
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

interface Group {
  name: string;
  swedishName: string;
  isThird: boolean;
  entries: StandingEntry[];
}

interface PlayerStat {
  player: { id: number; name: string; photo: string; nationality: string };
  statistics: [{
    team: { id: number; name: string; logo: string };
    goals: { total: number | null; assists: number | null };
    cards: { yellow: number; red: number };
  }];
}

interface Props {
  groups: Group[];
  topScorers: PlayerStat[];
  topAssists: PlayerStat[];
  topYellow: PlayerStat[];
  topRed: PlayerStat[];
  bracket: BracketMatchData[];
}

type Tab = "grupper" | "slutspel" | "statistik";
type StatTab = "mal" | "assist" | "gult" | "rott";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatList({ players, valueKey, label }: {
  players: PlayerStat[];
  valueKey: "goals" | "assists" | "yellow" | "red";
  label: string;
}) {
  const getValue = (p: PlayerStat) => {
    const s = p.statistics[0];
    if (valueKey === "goals") return s?.goals?.total ?? 0;
    if (valueKey === "assists") return s?.goals?.assists ?? 0;
    if (valueKey === "yellow") return s?.cards?.yellow ?? 0;
    return s?.cards?.red ?? 0;
  };

  const sorted = [...players].sort((a, b) => getValue(b) - getValue(a)).slice(0, 10);

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {sorted.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">Ingen data än.</p>
        ) : sorted.map((p, i) => (
          <div key={p.player.id} className="flex items-center gap-3 px-4 py-2.5">
            <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
            <Image src={p.player.photo} alt={p.player.name} width={28} height={28} className="rounded-full" unoptimized />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.player.name}</p>
              <p className="text-xs text-gray-400 truncate">{toSwedish(p.statistics[0]?.team?.name ?? "")}</p>
            </div>
            <span className="font-bold text-lg tabular-nums">{getValue(p)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TournamentInfo({ groups, topScorers, topAssists, topYellow, topRed, bracket }: Props) {
  const [tab, setTab] = useState<Tab>("grupper");
  const [statTab, setStatTab] = useState<StatTab>("mal");

  const tabs: { id: Tab; label: string }[] = [
    { id: "grupper", label: "Grupper" },
    { id: "slutspel", label: "Slutspel" },
    { id: "statistik", label: "Statistik" },
  ];

  const statTabs: { id: StatTab; label: string }[] = [
    { id: "mal", label: "Mål" },
    { id: "assist", label: "Assist" },
    { id: "gult", label: "Gula kort" },
    { id: "rott", label: "Röda kort" },
  ];

  return (
    <div>
      {/* Main tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800 mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.id
                ? "border-green-600 text-green-600 dark:text-green-400"
                : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Grupper */}
      {tab === "grupper" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {groups.map((group) => (
            <div key={group.name} className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{group.swedishName}</span>
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
                    <tr key={entry.team.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${group.isThird && idx === 7 ? "border-b-2 border-green-400 dark:border-green-600" : ""}`}>
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
                      <td className={`text-center px-2 py-2 font-medium ${entry.goalsDiff > 0 ? "text-green-600 dark:text-green-400" : entry.goalsDiff < 0 ? "text-red-500" : "text-gray-500"}`}>
                        {entry.goalsDiff > 0 ? `+${entry.goalsDiff}` : entry.goalsDiff}
                      </td>
                      <td className="text-right px-3 py-2 font-bold">{entry.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Slutspel */}
      {tab === "slutspel" && (
        <Bracket r32Matches={bracket} />
      )}

      {/* Statistik */}
      {tab === "statistik" && (
        <div>
          <div className="flex gap-2 mb-6 flex-wrap">
            {statTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setStatTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  statTab === t.id
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          {statTab === "mal" && <StatList players={topScorers} valueKey="goals" label="Flest mål" />}
          {statTab === "assist" && <StatList players={topAssists} valueKey="assists" label="Flest assist" />}
          {statTab === "gult" && <StatList players={topYellow} valueKey="yellow" label="Flest gula kort" />}
          {statTab === "rott" && <StatList players={topRed} valueKey="red" label="Flest röda kort" />}
        </div>
      )}
    </div>
  );
}
