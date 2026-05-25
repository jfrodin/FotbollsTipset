/**
 * Rensar och återskapar alla lag och gruppspelsmatcher för VM 2026.
 * Källa: FIFA officiellt spelschema (DAZN/Sky Sports). Tider i UTC.
 * Omvandling: BST (UTC+1) → UTC (dra av 1h).
 */
import { db } from "../src/db";
import { tournaments, phases, teams, tournamentTeams, matches } from "../src/db/schema";
import { eq, inArray } from "drizzle-orm";

const TEAMS: Record<string, { sv: string; code: string }> = {
  MEX: { sv: "Mexiko",              code: "MX" },
  RSA: { sv: "Sydafrika",           code: "ZA" },
  KOR: { sv: "Sydkorea",            code: "KR" },
  CZE: { sv: "Tjeckien",            code: "CZ" },
  CAN: { sv: "Kanada",              code: "CA" },
  BIH: { sv: "Bosnien-Hercegovina", code: "BA" },
  QAT: { sv: "Qatar",               code: "QA" },
  SUI: { sv: "Schweiz",             code: "CH" },
  BRA: { sv: "Brasilien",           code: "BR" },
  MAR: { sv: "Marocko",             code: "MA" },
  SCO: { sv: "Skottland",           code: "GB-SCT" },
  HAI: { sv: "Haiti",               code: "HT" },
  USA: { sv: "USA",                 code: "US" },
  PAR: { sv: "Paraguay",            code: "PY" },
  AUS: { sv: "Australien",          code: "AU" },
  TUR: { sv: "Turkiet",             code: "TR" },
  GER: { sv: "Tyskland",            code: "DE" },
  CIV: { sv: "Elfenbenskusten",     code: "CI" },
  ECU: { sv: "Ecuador",             code: "EC" },
  CUW: { sv: "Curaçao",            code: "CW" },
  NED: { sv: "Nederländerna",       code: "NL" },
  JPN: { sv: "Japan",               code: "JP" },
  SWE: { sv: "Sverige",             code: "SE" },
  TUN: { sv: "Tunisien",            code: "TN" },
  BEL: { sv: "Belgien",             code: "BE" },
  EGY: { sv: "Egypten",             code: "EG" },
  IRN: { sv: "Iran",                code: "IR" },
  NZL: { sv: "Nya Zeeland",         code: "NZ" },
  ESP: { sv: "Spanien",             code: "ES" },
  CPV: { sv: "Kap Verde",           code: "CV" },
  KSA: { sv: "Saudiarabien",        code: "SA" },
  URU: { sv: "Uruguay",             code: "UY" },
  FRA: { sv: "Frankrike",           code: "FR" },
  SEN: { sv: "Senegal",             code: "SN" },
  IRQ: { sv: "Irak",                code: "IQ" },
  NOR: { sv: "Norge",               code: "NO" },
  ARG: { sv: "Argentina",           code: "AR" },
  ALG: { sv: "Algeriet",            code: "DZ" },
  AUT: { sv: "Österrike",           code: "AT" },
  JOR: { sv: "Jordanien",           code: "JO" },
  POR: { sv: "Portugal",            code: "PT" },
  CGO: { sv: "DR Kongo",            code: "CD" },
  UZB: { sv: "Uzbekistan",          code: "UZ" },
  COL: { sv: "Colombia",            code: "CO" },
  ENG: { sv: "England",             code: "GB-ENG" },
  CRO: { sv: "Kroatien",            code: "HR" },
  GHA: { sv: "Ghana",               code: "GH" },
  PAN: { sv: "Panama",              code: "PA" },
};

const GROUPS: Record<string, string[]> = {
  A: ["MEX", "RSA", "KOR", "CZE"],
  B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "SCO", "HAI"],
  D: ["USA", "PAR", "AUS", "TUR"],
  E: ["GER", "CIV", "ECU", "CUW"],
  F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"],
  H: ["ESP", "CPV", "KSA", "URU"],
  I: ["FRA", "SEN", "IRQ", "NOR"],
  J: ["ARG", "ALG", "AUT", "JOR"],
  K: ["POR", "CGO", "UZB", "COL"],
  L: ["ENG", "CRO", "GHA", "PAN"],
};

// Alla 72 gruppspelsmatcher. Tider i UTC.
// Format: [utcDateTime, hemmalag-kod, bortalag-kod, grupp]
const SCHEDULE: [string, string, string, string][] = [
  // --- Omgång 1 ---
  ["2026-06-11T19:00:00Z", "MEX", "RSA",  "A"],
  ["2026-06-12T02:00:00Z", "KOR", "CZE",  "A"],
  ["2026-06-12T19:00:00Z", "CAN", "BIH",  "B"],
  ["2026-06-13T01:00:00Z", "USA", "PAR",  "D"],
  ["2026-06-13T19:00:00Z", "QAT", "SUI",  "B"],
  ["2026-06-13T22:00:00Z", "BRA", "MAR",  "C"],
  ["2026-06-14T01:00:00Z", "HAI", "SCO",  "C"],
  ["2026-06-14T04:00:00Z", "AUS", "TUR",  "D"],
  ["2026-06-14T17:00:00Z", "GER", "CUW",  "E"],
  ["2026-06-14T20:00:00Z", "NED", "JPN",  "F"],
  ["2026-06-14T23:00:00Z", "CIV", "ECU",  "E"],
  ["2026-06-15T02:00:00Z", "SWE", "TUN",  "F"],
  ["2026-06-15T16:00:00Z", "ESP", "CPV",  "H"],
  ["2026-06-15T19:00:00Z", "BEL", "EGY",  "G"],
  ["2026-06-15T22:00:00Z", "KSA", "URU",  "H"],
  ["2026-06-16T01:00:00Z", "IRN", "NZL",  "G"],
  ["2026-06-16T19:00:00Z", "FRA", "SEN",  "I"],
  ["2026-06-16T22:00:00Z", "IRQ", "NOR",  "I"],
  ["2026-06-17T01:00:00Z", "ARG", "ALG",  "J"],
  ["2026-06-17T04:00:00Z", "AUT", "JOR",  "J"],
  ["2026-06-17T17:00:00Z", "POR", "CGO",  "K"],
  ["2026-06-17T20:00:00Z", "ENG", "CRO",  "L"],
  ["2026-06-17T23:00:00Z", "GHA", "PAN",  "L"],
  ["2026-06-18T02:00:00Z", "UZB", "COL",  "K"],
  // --- Omgång 2 ---
  ["2026-06-18T16:00:00Z", "CZE", "RSA",  "A"],
  ["2026-06-18T19:00:00Z", "SUI", "BIH",  "B"],
  ["2026-06-18T22:00:00Z", "CAN", "QAT",  "B"],
  ["2026-06-19T01:00:00Z", "MEX", "KOR",  "A"],
  ["2026-06-19T19:00:00Z", "USA", "AUS",  "D"],
  ["2026-06-19T22:00:00Z", "SCO", "MAR",  "C"],
  ["2026-06-20T00:30:00Z", "BRA", "HAI",  "C"],
  ["2026-06-20T03:00:00Z", "TUR", "PAR",  "D"],
  ["2026-06-20T17:00:00Z", "NED", "SWE",  "F"],
  ["2026-06-20T20:00:00Z", "GER", "CIV",  "E"],
  ["2026-06-21T00:00:00Z", "ECU", "CUW",  "E"],
  ["2026-06-21T04:00:00Z", "TUN", "JPN",  "F"],
  ["2026-06-21T16:00:00Z", "ESP", "KSA",  "H"],
  ["2026-06-21T19:00:00Z", "BEL", "IRN",  "G"],
  ["2026-06-21T22:00:00Z", "URU", "CPV",  "H"],
  ["2026-06-22T01:00:00Z", "NZL", "EGY",  "G"],
  ["2026-06-22T17:00:00Z", "ARG", "AUT",  "J"],
  ["2026-06-22T21:00:00Z", "FRA", "IRQ",  "I"],
  ["2026-06-23T00:00:00Z", "NOR", "SEN",  "I"],
  ["2026-06-23T03:00:00Z", "JOR", "ALG",  "J"],
  ["2026-06-23T17:00:00Z", "POR", "UZB",  "K"],
  ["2026-06-23T20:00:00Z", "ENG", "GHA",  "L"],
  ["2026-06-23T23:00:00Z", "COL", "CGO",  "K"],
  ["2026-06-24T02:00:00Z", "PAN", "CRO",  "L"],
  // --- Omgång 3 (simultana matcher) ---
  ["2026-06-24T19:00:00Z", "BIH", "QAT",  "B"],
  ["2026-06-24T19:00:00Z", "SUI", "CAN",  "B"],
  ["2026-06-24T22:00:00Z", "MAR", "HAI",  "C"],
  ["2026-06-24T22:00:00Z", "SCO", "BRA",  "C"],
  ["2026-06-25T01:00:00Z", "CZE", "MEX",  "A"],
  ["2026-06-25T01:00:00Z", "RSA", "KOR",  "A"],
  ["2026-06-25T20:00:00Z", "CUW", "CIV",  "E"],
  ["2026-06-25T20:00:00Z", "ECU", "GER",  "E"],
  ["2026-06-25T23:00:00Z", "JPN", "SWE",  "F"],
  ["2026-06-25T23:00:00Z", "TUN", "NED",  "F"],
  ["2026-06-26T02:00:00Z", "PAR", "AUS",  "D"],
  ["2026-06-26T02:00:00Z", "TUR", "USA",  "D"],
  ["2026-06-26T19:00:00Z", "NOR", "FRA",  "I"],
  ["2026-06-26T19:00:00Z", "IRQ", "SEN",  "I"],
  ["2026-06-27T00:00:00Z", "CPV", "KSA",  "H"],
  ["2026-06-27T00:00:00Z", "URU", "ESP",  "H"],
  ["2026-06-27T03:00:00Z", "EGY", "IRN",  "G"],
  ["2026-06-27T03:00:00Z", "NZL", "BEL",  "G"],
  ["2026-06-27T21:00:00Z", "CRO", "GHA",  "L"],
  ["2026-06-27T21:00:00Z", "PAN", "ENG",  "L"],
  ["2026-06-27T23:30:00Z", "COL", "POR",  "K"],
  ["2026-06-27T23:30:00Z", "CGO", "UZB",  "K"],
  ["2026-06-28T02:00:00Z", "ALG", "AUT",  "J"],
  ["2026-06-28T02:00:00Z", "JOR", "ARG",  "J"],
];

async function main() {
  console.log("Rensar gamla matcher och lag...");

  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.name, "VM"))
    .limit(1);

  if (!tournament) {
    console.error("Ingen VM-turnering hittad. Kör seed.ts först.");
    process.exit(1);
  }

  const [phase] = await db
    .select()
    .from(phases)
    .where(eq(phases.tournamentId, tournament.id))
    .limit(1);

  if (!phase) {
    console.error("Ingen fas hittad.");
    process.exit(1);
  }

  // Ta bort gamla matcher och turneringskopplingar
  await db.delete(matches).where(eq(matches.tournamentId, tournament.id));
  await db.delete(tournamentTeams).where(eq(tournamentTeams.tournamentId, tournament.id));
  console.log("✓ Gamla matcher och lag borttagna");

  // Skapa lag
  const teamIds: Record<string, string> = {};
  for (const [key, { sv, code }] of Object.entries(TEAMS)) {
    const [existing] = await db
      .select()
      .from(teams)
      .where(eq(teams.name, sv))
      .limit(1);

    if (existing) {
      teamIds[key] = existing.id;
    } else {
      const [created] = await db
        .insert(teams)
        .values({ name: sv, shortName: sv.substring(0, 3).toUpperCase(), countryCode: code })
        .returning();
      teamIds[key] = created.id;
    }
  }

  // Koppla lag till grupper
  for (const [group, keys] of Object.entries(GROUPS)) {
    for (const key of keys) {
      await db
        .insert(tournamentTeams)
        .values({ tournamentId: tournament.id, teamId: teamIds[key], groupName: `Grupp ${group}` })
        .onConflictDoNothing();
    }
  }
  console.log(`✓ ${Object.keys(TEAMS).length} lag skapade och grupperade`);

  // Skapa matcher
  for (const [utcStr, homeKey, awayKey, group] of SCHEDULE) {
    await db.insert(matches).values({
      tournamentId: tournament.id,
      phaseId: phase.id,
      homeTeamId: teamIds[homeKey],
      awayTeamId: teamIds[awayKey],
      startsAt: new Date(utcStr),
      status: "scheduled",
      groupName: `Grupp ${group}`,
      roundName: `Grupp ${group}`,
    });
  }

  console.log(`✓ ${SCHEDULE.length} matcher skapade med korrekta tider`);
  console.log("Klart!");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
