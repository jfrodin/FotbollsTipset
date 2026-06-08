export const TEAM_NAME_TO_SV: Record<string, string> = {
  "Mexico": "Mexiko", "South Africa": "Sydafrika", "South Korea": "Sydkorea",
  "Czechia": "Tjeckien", "Czech Republic": "Tjeckien", "Canada": "Kanada",
  "Bosnia and Herzegovina": "Bosnien-Hercegovina", "Bosnia & Herzegovina": "Bosnien-Hercegovina",
  "Qatar": "Qatar", "Switzerland": "Schweiz", "Brazil": "Brasilien", "Morocco": "Marocko",
  "Scotland": "Skottland", "Haiti": "Haiti", "USA": "USA", "United States": "USA",
  "Paraguay": "Paraguay", "Australia": "Australien", "Turkey": "Turkiet", "Türkiye": "Turkiet",
  "Germany": "Tyskland", "Ivory Coast": "Elfenbenskusten", "Ecuador": "Ecuador",
  "Curacao": "Curaçao", "Curaçao": "Curaçao", "Netherlands": "Nederländerna",
  "Japan": "Japan", "Sweden": "Sverige", "Tunisia": "Tunisien", "Belgium": "Belgien",
  "Egypt": "Egypten", "Iran": "Iran", "New Zealand": "Nya Zeeland", "Spain": "Spanien",
  "Cape Verde": "Kap Verde", "Cape Verde Islands": "Kap Verde",
  "Saudi Arabia": "Saudiarabien", "Saudi-Arabien": "Saudiarabien",
  "Uruguay": "Uruguay", "France": "Frankrike", "Senegal": "Senegal", "Iraq": "Irak",
  "Norway": "Norge", "Argentina": "Argentina", "Algeria": "Algeriet", "Austria": "Österrike",
  "Jordan": "Jordanien", "Portugal": "Portugal", "DR Congo": "DR Kongo", "Congo DR": "DR Kongo",
  "Uzbekistan": "Uzbekistan", "Colombia": "Colombia", "England": "England",
  "Croatia": "Kroatien", "Ghana": "Ghana", "Panama": "Panama",
  "Serbia": "Serbien", "Ukraine": "Ukraina", "Poland": "Polen", "Denmark": "Danmark",
  "Wales": "Wales", "Italy": "Italien",
};

export function toSwedish(name: string): string {
  return TEAM_NAME_TO_SV[name] ?? name;
}
