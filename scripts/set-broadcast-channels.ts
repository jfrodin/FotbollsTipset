import { db } from "../src/db";
import { matches, teams } from "../src/db/schema";
import { eq } from "drizzle-orm";

// Format: [homeTeam, awayTeam, channel]
// Lagnamn matchar svenska namn i DB
const DATA: [string, string, string][] = [
  ["Mexiko", "Sydafrika", "TV4"],
  ["Sydkorea", "Tjeckien", "TV4"],
  ["Kanada", "Bosnien-Hercegovina", "SVT"],
  ["USA", "Paraguay", "TV4"],
  ["Qatar", "Schweiz", "TV4"],
  ["Brasilien", "Marocko", "SVT"],
  ["Haiti", "Skottland", "SVT"],
  ["Australien", "Turkiet", "TV4"],
  ["Tyskland", "Curaçao", "TV4"],
  ["Nederländerna", "Japan", "TV4"],
  ["Elfenbenskusten", "Ecuador", "TV4"],
  ["Sverige", "Tunisien", "SVT"],
  ["Spanien", "Kap Verde", "SVT"],
  ["Belgien", "Egypten", "SVT"],
  ["Saudiarabien", "Uruguay", "TV4"],
  ["Iran", "Nya Zeeland", "TV4"],
  ["Frankrike", "Senegal", "SVT"],
  ["Irak", "Norge", "TV4"],
  ["Argentina", "Algeriet", "TV4"],
  ["Österrike", "Jordanien", "TV4"],
  ["Portugal", "DR Kongo", "TV4"],
  ["England", "Kroatien", "TV4"],
  ["Ghana", "Panama", "TV4"],
  ["Uzbekistan", "Colombia", "TV4"],
  ["Tjeckien", "Sydafrika", "TV4"],
  ["Schweiz", "Bosnien-Hercegovina", "TV4"],
  ["Kanada", "Qatar", "TV4"],
  ["Mexiko", "Sydkorea", "TV4"],
  ["USA", "Australien", "SVT"],
  ["Skottland", "Marocko", "SVT"],
  ["Brasilien", "Haiti", "TV4"],
  ["Turkiet", "Paraguay", "TV4"],
  ["Nederländerna", "Sverige", "TV4"],
  ["Tyskland", "Elfenbenskusten", "TV4"],
  ["Ecuador", "Curaçao", "TV4"],
  ["Tunisien", "Japan", "SVT"],
  ["Spanien", "Saudiarabien", "TV4"],
  ["Belgien", "Iran", "TV4"],
  ["Uruguay", "Kap Verde", "TV4"],
  ["Nya Zeeland", "Egypten", "TV4"],
  ["Argentina", "Österrike", "SVT"],
  ["Frankrike", "Irak", "SVT"],
  ["Norge", "Senegal", "SVT"],
  ["Jordanien", "Algeriet", "TV4"],
  ["Portugal", "Uzbekistan", "SVT"],
  ["England", "Ghana", "SVT"],
  ["Panama", "Kroatien", "TV4"],
  ["Colombia", "DR Kongo", "TV4"],
  ["Schweiz", "Kanada", "TV4"],
  ["Bosnien-Hercegovina", "Qatar", "TV4"],
  ["Marocko", "Haiti", "TV4"],
  ["Skottland", "Brasilien", "TV4"],
  ["Sydafrika", "Sydkorea", "SVT"],
  ["Tjeckien", "Mexiko", "SVT"],
  ["Curaçao", "Elfenbenskusten", "SVT"],
  ["Ecuador", "Tyskland", "SVT"],
  ["Tunisien", "Nederländerna", "SVT"],
  ["Japan", "Sverige", "SVT"],
  ["Turkiet", "USA", "TV4"],
  ["Paraguay", "Australien", "TV4"],
  ["Norge", "Frankrike", "TV4"],
  ["Senegal", "Irak", "TV4"],
  ["Kap Verde", "Saudiarabien", "TV4"],
  ["Uruguay", "Spanien", "TV4"],
  ["Nya Zeeland", "Belgien", "TV4"],
  ["Egypten", "Iran", "TV4"],
  ["Panama", "England", "SVT"],
  ["Kroatien", "Ghana", "SVT"],
  ["DR Kongo", "Uzbekistan", "TV4"],
  ["Colombia", "Portugal", "TV4"],
  ["Algeriet", "Österrike", "TV4"],
  ["Jordanien", "Argentina", "TV4"],
];

async function main() {
  const allTeams = await db.select({ id: teams.id, name: teams.name }).from(teams);
  // Bygg en map med ALLA id:n per lagnamn (hanterar dubbletter)
  const teamMap = new Map<string, string[]>();
  for (const t of allTeams) {
    if (!teamMap.has(t.name)) teamMap.set(t.name, []);
    teamMap.get(t.name)!.push(t.id);
  }

  const allMatches = await db.select({
    id: matches.id,
    homeTeamId: matches.homeTeamId,
    awayTeamId: matches.awayTeamId,
  }).from(matches);

  let updated = 0;
  let notFound = 0;

  for (const [home, away, channel] of DATA) {
    const homeIds = teamMap.get(home) ?? [];
    const awayIds = teamMap.get(away) ?? [];

    if (homeIds.length === 0 || awayIds.length === 0) {
      console.log(`⚠️  Lag inte hittat: ${home} vs ${away}`);
      notFound++;
      continue;
    }

    const match = allMatches.find(m =>
      homeIds.includes(m.homeTeamId!) && awayIds.includes(m.awayTeamId!)
    );
    if (!match) {
      console.log(`⚠️  Match inte hittad: ${home} vs ${away}`);
      notFound++;
      continue;
    }

    await db.update(matches).set({ broadcastChannel: channel }).where(eq(matches.id, match.id));
    console.log(`✓ ${home} vs ${away} → ${channel}`);
    updated++;
  }

  console.log(`\nUppdaterade ${updated} matcher, ${notFound} inte hittade.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
