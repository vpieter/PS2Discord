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

export enum Status {
  'Planned' = 1,
  'Opened' = 2,
  'Started' = 3,
  'Stopped' = 4,
  'Closed' = 5,
};
