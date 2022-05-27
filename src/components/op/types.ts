import { OutfitMemberVM } from "../../ps2-rest-client/types";

export type Leaderboard = {
  score: number,
  scorePerMinute: number,
  entries: Array<LeaderboardEntry>,
};

export type LeaderboardEntry = {
  score: number,
  scorePerMinute: number,
  scorePercentageOfTotal: number,
  rank: number,
  member: OutfitMemberVM,
};
