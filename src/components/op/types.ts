import { OutfitMemberVM } from "../../ps2-rest-client/types";

export type Leaderboard = {
  score: number,
  entries: Array<LeaderboardEntry>
};

export type LeaderboardEntry = {
  score: number,
  rank: number,
  member: OutfitMemberVM,
};
