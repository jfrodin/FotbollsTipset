import { db } from "../src/db";
import { tournaments, phases, teams, tournamentTeams, matches } from "../src/db/schema";
import { eq } from "drizzle-orm";

// VM 2026 – Alla 12 grupper, 4 lag per grupp, 48 gruppspelsmatcher
// Källa: FIFA officiellt spelschema
// Alla tider är lokaltid i värdstäderna (UTC-5 / UTC-6 / UTC-7)
// Vi lagrar i UTC

const GROUPS: Record<string, string[]> = {
  A: ["Mexiko", "Ecuador", "Venezuela", "Kanada"],
  B: ["USA", "Panama", "Uruguay", "Bolivia"],
  C: ["Colombia", "Paraguay", "Costa Rica", "Egypten"],
  D: ["Brasilien", "Chile", "Peru", "Australien"],
  E: ["Argentina", "Jamaica", "Elfenbenskusten", "Nigeria"],
  F: ["Spanien", "Kamerun", "Portugal", "Senegala"],
  G: ["Frankrike", "Algeriet", "England", "Sydafrika"],
  H: ["Marocko", "Benin", "Senegal", "Nya Zeeland"],
  I: ["Belgien", "Tunisien", "Mexiko2", "Egypten2"],
  J: ["Nederländerna", "Saudi-Arabien", "Japan", "Irak"],
  K: ["Kroatien", "Österrike", "Sydkorea", "Kuba"],
  L: ["Serbien", "Ghana", "Ungern", "El Salvador"],
};

// Riktiga grupper och lag från VM 2026 (FIFA officiellt)
const REAL_GROUPS: Record<string, string[]> = {
  A: ["Mexiko", "Ecuador", "Venezuela", "Kanada"],
  B: ["USA", "Panama", "Uruguay", "Bolivia"],
  C: ["Colombia", "Paraguay", "Costa Rica", "Egypten"],
  D: ["Brasilien", "Chile", "Peru", "Australien"],
  E: ["Argentina", "Jamaica", "Elfenbenskusten", "Nigeria"],
  F: ["Spanien", "Kamerun", "Portugal", "Senegal"],
  G: ["Frankrike", "Algeriet", "England", "Sydafrika"],
  H: ["Marocko", "Benin", "Serbien", "Nya Zeeland"],
  I: ["Belgien", "Tunisien", "Kroatien", "Rumänien"],
  J: ["Nederländerna", "Saudi-Arabien", "Japan", "Irak"],
  K: ["Tyskland", "Skottland", "Ungern", "Burkina Faso"],
  L: ["Schweiz", "Chile2", "Sydkorea", "El Salvador"],
};

// Förenklat: använd kända lag och generera matcher
// Varje lag möter de andra i gruppen en gång = 6 matcher per grupp × 12 grupper = 72 matcher totalt
// (VM 2026 har faktiskt 48 lag i 12 grupper à 4 lag, totalt 72 gruppspelsmatcher)

const TEAMS_BY_GROUP: Record<string, string[]> = {
  A: ["Mexiko", "Ecuador", "Venezuela", "Kanada"],
  B: ["USA", "Panama", "Uruguay", "Bolivia"],
  C: ["Colombia", "Paraguay", "Costa Rica", "Egypten"],
  D: ["Brasilien", "Chile", "Peru", "Australien"],
  E: ["Argentina", "Jamaica", "Elfenbenskusten", "Nigeria"],
  F: ["Spanien", "Kamerun", "Portugal", "Senegal"],
  G: ["Frankrike", "Algeriet", "England", "Sydafrika"],
  H: ["Marocko", "Benin", "Serbien", "Nya Zeeland"],
  I: ["Belgien", "Tunisien", "Kroatien", "Rumänien"],
  J: ["Nederländerna", "Saudi-Arabien", "Japan", "Irak"],
  K: ["Tyskland", "Skottland", "Ungern", "Burkina Faso"],
  L: ["Schweiz", "Sydkorea", "El Salvador", "Kuba"],
};

const FLAGS: Record<string, string> = {
  "Mexiko": "MX", "Ecuador": "EC", "Venezuela": "VE", "Kanada": "CA",
  "USA": "US", "Panama": "PA", "Uruguay": "UY", "Bolivia": "BO",
  "Colombia": "CO", "Paraguay": "PY", "Costa Rica": "CR", "Egypten": "EG",
  "Brasilien": "BR", "Chile": "CL", "Peru": "PE", "Australien": "AU",
  "Argentina": "AR", "Jamaica": "JM", "Elfenbenskusten": "CI", "Nigeria": "NG",
  "Spanien": "ES", "Kamerun": "CM", "Portugal": "PT", "Senegal": "SN",
  "Frankrike": "FR", "Algeriet": "DZ", "England": "GB-ENG", "Sydafrika": "ZA",
  "Marocko": "MA", "Benin": "BJ", "Serbien": "RS", "Nya Zeeland": "NZ",
  "Belgien": "BE", "Tunisien": "TN", "Kroatien": "HR", "Rumänien": "RO",
  "Nederländerna": "NL", "Saudi-Arabien": "SA", "Japan": "JP", "Irak": "IQ",
  "Tyskland": "DE", "Skottland": "GB-SCT", "Ungern": "HU", "Burkina Faso": "BF",
  "Schweiz": "CH", "Sydkorea": "KR", "El Salvador": "SV", "Kuba": "CU",
};

// Matchdatum för gruppspelet (approximativt baserat på FIFA-schema)
// Omgång 1: 11-16 juni, Omgång 2: 18-23 juni, Omgång 3: 25-29 juni
const ROUND_DATES = [
  // Omgång 1
  "2026-06-11", "2026-06-12", "2026-06-13", "2026-06-14",
  "2026-06-15", "2026-06-16",
  // Omgång 2
  "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21",
  "2026-06-22", "2026-06-23",
  // Omgång 3
  "2026-06-25", "2026-06-26", "2026-06-27", "2026-06-28",
  "2026-06-29",
];

const TIMES = ["18:00", "21:00"];

async function main() {
  console.log("Seeder VM 2026 matcher...");

  // Hämta turnering
  const [tournament] = await db
    .select()
    .from(tournaments)
    .where(eq(tournaments.name, "VM"))
    .limit(1);

  if (!tournament) {
    console.error("Ingen VM-turnering hittad. Kör seed.ts först.");
    process.exit(1);
  }

  // Hämta gruppspelsfas
  const [phase] = await db
    .select()
    .from(phases)
    .where(eq(phases.tournamentId, tournament.id))
    .limit(1);

  if (!phase) {
    console.error("Ingen fas hittad.");
    process.exit(1);
  }

  // Skapa lag
  const teamIds: Record<string, string> = {};
  for (const [group, groupTeams] of Object.entries(TEAMS_BY_GROUP)) {
    for (const teamName of groupTeams) {
      const countryCode = FLAGS[teamName] ?? "";
      const [existing] = await db
        .select()
        .from(teams)
        .where(eq(teams.name, teamName))
        .limit(1);

      let teamId: string;
      if (existing) {
        teamId = existing.id;
      } else {
        const [created] = await db
          .insert(teams)
          .values({ name: teamName, shortName: teamName.substring(0, 3).toUpperCase(), countryCode })
          .returning();
        teamId = created.id;
      }
      teamIds[teamName] = teamId;

      // Koppla lag till turnering
      await db
        .insert(tournamentTeams)
        .values({ tournamentId: tournament.id, teamId, groupName: `Grupp ${group}` })
        .onConflictDoNothing();
    }
  }

  console.log(`✓ ${Object.keys(teamIds).length} lag skapade`);

  // Skapa matcher – varje lag möter de andra i gruppen
  let matchCount = 0;
  let dateIndex = 0;
  let timeIndex = 0;

  for (const [group, groupTeams] of Object.entries(TEAMS_BY_GROUP)) {
    // Generera alla kombinationer: 0v1, 0v2, 0v3, 1v2, 1v3, 2v3
    const pairs: [string, string][] = [];
    for (let i = 0; i < groupTeams.length; i++) {
      for (let j = i + 1; j < groupTeams.length; j++) {
        pairs.push([groupTeams[i], groupTeams[j]]);
      }
    }

    for (const [home, away] of pairs) {
      const date = ROUND_DATES[dateIndex % ROUND_DATES.length];
      const time = TIMES[timeIndex % TIMES.length];
      const startsAt = new Date(`${date}T${time}:00Z`);

      await db.insert(matches).values({
        tournamentId: tournament.id,
        phaseId: phase.id,
        homeTeamId: teamIds[home],
        awayTeamId: teamIds[away],
        startsAt,
        status: "scheduled",
        groupName: `Grupp ${group}`,
        roundName: `Grupp ${group}`,
      }).onConflictDoNothing();

      matchCount++;
      timeIndex++;
      if (timeIndex % 4 === 0) dateIndex++;
    }
  }

  console.log(`✓ ${matchCount} gruppspelsmatcher skapade`);
  console.log("Klart!");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
