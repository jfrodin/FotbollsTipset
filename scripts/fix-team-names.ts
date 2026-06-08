import { db } from "../src/db";
import { teams } from "../src/db/schema";
import { eq } from "drizzle-orm";

const FIXES: Record<string, { sv: string; code: string }> = {
  "Mexico": { sv: "Mexiko", code: "MX" },
  "South Africa": { sv: "Sydafrika", code: "ZA" },
  "South Korea": { sv: "Sydkorea", code: "KR" },
  "Czechia": { sv: "Tjeckien", code: "CZ" },
  "Czech Republic": { sv: "Tjeckien", code: "CZ" },
  "Canada": { sv: "Kanada", code: "CA" },
  "Bosnia and Herzegovina": { sv: "Bosnien-Hercegovina", code: "BA" },
  "Bosnia & Herzegovina": { sv: "Bosnien-Hercegovina", code: "BA" },
  "Qatar": { sv: "Qatar", code: "QA" },
  "Switzerland": { sv: "Schweiz", code: "CH" },
  "Brazil": { sv: "Brasilien", code: "BR" },
  "Morocco": { sv: "Marocko", code: "MA" },
  "Scotland": { sv: "Skottland", code: "GB-SCT" },
  "Haiti": { sv: "Haiti", code: "HT" },
  "USA": { sv: "USA", code: "US" },
  "United States": { sv: "USA", code: "US" },
  "Paraguay": { sv: "Paraguay", code: "PY" },
  "Australia": { sv: "Australien", code: "AU" },
  "Turkey": { sv: "Turkiet", code: "TR" },
  "Türkiye": { sv: "Turkiet", code: "TR" },
  "Germany": { sv: "Tyskland", code: "DE" },
  "Ivory Coast": { sv: "Elfenbenskusten", code: "CI" },
  "Ecuador": { sv: "Ecuador", code: "EC" },
  "Curacao": { sv: "Curaçao", code: "CW" },
  "Curaçao": { sv: "Curaçao", code: "CW" },
  "Netherlands": { sv: "Nederländerna", code: "NL" },
  "Japan": { sv: "Japan", code: "JP" },
  "Sweden": { sv: "Sverige", code: "SE" },
  "Tunisia": { sv: "Tunisien", code: "TN" },
  "Belgium": { sv: "Belgien", code: "BE" },
  "Egypt": { sv: "Egypten", code: "EG" },
  "Iran": { sv: "Iran", code: "IR" },
  "New Zealand": { sv: "Nya Zeeland", code: "NZ" },
  "Spain": { sv: "Spanien", code: "ES" },
  "Cape Verde": { sv: "Kap Verde", code: "CV" },
  "Cape Verde Islands": { sv: "Kap Verde", code: "CV" },
  "Saudi Arabia": { sv: "Saudiarabien", code: "SA" },
  "Saudi-Arabien": { sv: "Saudiarabien", code: "SA" },
  "Uruguay": { sv: "Uruguay", code: "UY" },
  "France": { sv: "Frankrike", code: "FR" },
  "Senegal": { sv: "Senegal", code: "SN" },
  "Iraq": { sv: "Irak", code: "IQ" },
  "Norway": { sv: "Norge", code: "NO" },
  "Argentina": { sv: "Argentina", code: "AR" },
  "Algeria": { sv: "Algeriet", code: "DZ" },
  "Austria": { sv: "Österrike", code: "AT" },
  "Jordan": { sv: "Jordanien", code: "JO" },
  "Portugal": { sv: "Portugal", code: "PT" },
  "DR Congo": { sv: "DR Kongo", code: "CD" },
  "Congo DR": { sv: "DR Kongo", code: "CD" },
  "Uzbekistan": { sv: "Uzbekistan", code: "UZ" },
  "Colombia": { sv: "Colombia", code: "CO" },
  "England": { sv: "England", code: "GB-ENG" },
  "Croatia": { sv: "Kroatien", code: "HR" },
  "Ghana": { sv: "Ghana", code: "GH" },
  "Panama": { sv: "Panama", code: "PA" },
};

async function main() {
  const allTeams = await db.select().from(teams);
  let updated = 0;
  for (const team of allTeams) {
    const fix = FIXES[team.name];
    if (fix) {
      await db.update(teams).set({ name: fix.sv, countryCode: fix.code }).where(eq(teams.id, team.id));
      console.log(`${team.name} → ${fix.sv} (${fix.code})`);
      updated++;
    }
  }
  console.log(`\nUppdaterade ${updated} lag.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
