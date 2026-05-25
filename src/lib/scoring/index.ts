interface ScoreResult {
  points: number;
  isExactScore: boolean;
  isCorrectOutcome: boolean;
}

function getOutcome(home: number, away: number): "home" | "away" | "draw" {
  if (home > away) return "home";
  if (away > home) return "away";
  return "draw";
}

export function calculatePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  pointsForOutcome = 2,
  pointsForExact = 3
): ScoreResult {
  const isExactScore = predictedHome === actualHome && predictedAway === actualAway;
  const isCorrectOutcome = getOutcome(predictedHome, predictedAway) === getOutcome(actualHome, actualAway);

  let points = 0;
  if (isCorrectOutcome) points += pointsForOutcome;
  if (isExactScore) points += pointsForExact;

  return { points, isExactScore, isCorrectOutcome };
}
