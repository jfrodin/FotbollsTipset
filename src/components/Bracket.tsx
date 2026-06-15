"use client";
import Image from "next/image";
import { toSwedish } from "@/lib/team-names";

// ─── Constants ────────────────────────────────────────────────────────────────
const SLOT    = 64;  // vertical space per R32 match
const CARD_H  = 52;  // match card height
const CARD_W  = 140; // match card width
const CONN_W  = 20;  // connector SVG width
const N       = 8;   // R32 matches per bracket half
const HALF_H  = N * SLOT; // 512px total height

// ─── Types ────────────────────────────────────────────────────────────────────
type Team = { name: string; logo: string };
type Slot = { label: string; team: Team | null };
export type BracketMatchData = { home: Slot; away: Slot };

// ─── Helpers ─────────────────────────────────────────────────────────────────
const tbd  = (label = "TBD"): Slot => ({ label, team: null });
const tbdM = (): BracketMatchData => ({ home: tbd(), away: tbd() });

// Center Y position for match at [round, index] within a half
function cy(round: number, idx: number): number {
  const span = 1 << round; // slots this match occupies (2^round)
  return (idx * span + span / 2) * SLOT;
}

// ─── Team row inside a match card ─────────────────────────────────────────────
function TeamRow({ slot, top }: { slot: Slot; top: boolean }) {
  return (
    <div className={`flex items-center gap-1.5 px-2 h-[26px] min-w-0 ${top ? "border-b border-gray-100 dark:border-gray-800" : ""}`}>
      {slot.team
        ? <Image src={slot.team.logo} alt="" width={14} height={14} unoptimized className="shrink-0" />
        : <div className="w-3.5 h-3.5 shrink-0 rounded-full bg-gray-100 dark:bg-gray-800" />}
      <span className={`text-xs truncate ${slot.team ? "font-medium text-gray-800 dark:text-gray-200" : "text-gray-400 italic"}`}>
        {slot.team ? toSwedish(slot.team.name) : slot.label}
      </span>
    </div>
  );
}

// ─── Single match card ────────────────────────────────────────────────────────
function MatchCard({ match, highlight }: { match: BracketMatchData; highlight?: boolean }) {
  return (
    <div
      className={`absolute left-0 bg-white dark:bg-gray-900 border rounded-lg overflow-hidden shadow-sm ${highlight ? "border-green-500 dark:border-green-500" : "border-gray-200 dark:border-gray-800"}`}
      style={{ width: CARD_W, height: CARD_H }}
    >
      <TeamRow slot={match.home} top />
      <TeamRow slot={match.away} top={false} />
    </div>
  );
}

// ─── Column of matches for one round ─────────────────────────────────────────
function Col({ matches, round, label, highlight }: {
  matches: BracketMatchData[];
  round: number;
  label?: string;
  highlight?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ width: CARD_W, height: HALF_H }}>
      {label && (
        <div className="absolute -top-8 inset-x-0 text-center text-[10px] font-bold uppercase tracking-wider whitespace-nowrap text-gray-400">
          {label}
        </div>
      )}
      {matches.map((m, i) => (
        <div key={i} className="absolute w-full" style={{ top: cy(round, i) - CARD_H / 2 }}>
          <MatchCard match={m} highlight={highlight} />
        </div>
      ))}
    </div>
  );
}

// ─── SVG bracket connectors between rounds ────────────────────────────────────
function ConnSVG({ fromRound, count, flip = false }: { fromRound: number; count: number; flip?: boolean }) {
  const mid = CONN_W / 2;
  const paths: string[] = [];

  for (let i = 0; i < count / 2; i++) {
    const y1 = cy(fromRound, i * 2);
    const y2 = cy(fromRound, i * 2 + 1);
    const yn = cy(fromRound + 1, i);
    if (!flip) {
      paths.push(`M0,${y1} H${mid} V${yn} H${CONN_W}`);
      paths.push(`M0,${y2} H${mid} V${yn}`);
    } else {
      paths.push(`M${CONN_W},${y1} H${mid} V${yn} H0`);
      paths.push(`M${CONN_W},${y2} H${mid} V${yn}`);
    }
  }

  return (
    <svg className="shrink-0" width={CONN_W} height={HALF_H} style={{ overflow: "visible" }}>
      {paths.map((d, i) => (
        <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round"
          className="text-gray-200 dark:text-gray-700" />
      ))}
    </svg>
  );
}

// ─── Straight connector from SF to Final ──────────────────────────────────────
function SFtoFinal() {
  const midY = HALF_H / 2; // always 256 = cy(3, 0)
  return (
    <svg className="shrink-0" width={CONN_W} height={HALF_H}>
      <line x1={0} y1={midY} x2={CONN_W} y2={midY} stroke="currentColor" strokeWidth={1.5}
        className="text-gray-200 dark:text-gray-700" />
    </svg>
  );
}

// ─── Main Bracket ─────────────────────────────────────────────────────────────
export function Bracket({ r32Matches }: { r32Matches: BracketMatchData[] }) {
  const leftR32  = r32Matches.slice(0, 8);
  const rightR32 = r32Matches.slice(8, 16);

  const r16 = Array(4).fill(null).map(tbdM);
  const qf  = Array(2).fill(null).map(tbdM);
  const sf  = [tbdM()];
  const fin: BracketMatchData = {
    home: tbd("Vinnare SF 1"),
    away: tbd("Vinnare SF 2"),
  };

  return (
    <div className="overflow-x-auto -mx-4 px-4 pb-4">
      <p className="text-xs text-gray-400 mb-4">
        Visar nuläget i grupperna – uppdateras efter varje resultat.
      </p>
      <div className="inline-flex items-start pt-10">

        {/* ── LEFT HALF: R32 → R16 → QF → SF ── */}
        <Col matches={leftR32} round={0} label="Sextondelar" />
        <ConnSVG fromRound={0} count={8} />
        <Col matches={r16}     round={1} label="Åttondelar" />
        <ConnSVG fromRound={1} count={4} />
        <Col matches={qf}      round={2} label="Kvartsfinaler" />
        <ConnSVG fromRound={2} count={2} />
        <Col matches={sf}      round={3} label="Semifinal" />
        <SFtoFinal />

        {/* ── FINAL ── */}
        <div className="relative shrink-0" style={{ width: CARD_W, height: HALF_H }}>
          <div className="absolute -top-8 inset-x-0 text-center text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">
            🏆 Final
          </div>
          <div className="absolute w-full" style={{ top: HALF_H / 2 - CARD_H / 2 }}>
            <MatchCard match={fin} highlight />
          </div>
        </div>

        {/* ── RIGHT HALF: SF → QF → R16 → R32 ── */}
        <SFtoFinal />
        <Col matches={sf}       round={3} />
        <ConnSVG fromRound={2} count={2} flip />
        <Col matches={qf}       round={2} />
        <ConnSVG fromRound={1} count={4} flip />
        <Col matches={r16}      round={1} />
        <ConnSVG fromRound={0} count={8} flip />
        <Col matches={rightR32} round={0} label="Sextondelar" />

      </div>
    </div>
  );
}
