import { DateTime } from "luxon";

export type TrackedDiscordUser = {
  id: string,
  username: string,
  displayName: string,
  displayNameHistory: Array<{
    date: DateTime,
    displayName: string,
  }>,
  voiceHistory: Array<{
    date: DateTime,
    channelName: string,
  }>,
  member: boolean,
  role: string,
};

export const getEmptyTrackedDiscordUser: () => TrackedDiscordUser = () => ({ id: '', username: '', displayName: '', displayNameHistory: [], member: false, role: '', voiceHistory: [] });
