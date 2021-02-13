import { Commands } from './consts';
import { Message as DiscordMessage, User, VoiceChannel } from 'discord.js';
import { DeathDto, GainExperienceDto } from './ps2-streaming-client/types';
import { FacilityVM } from './ps2-rest-client/types';
import { DateTime } from 'luxon';

export type Command = {
  mention: string;
  commandName: Commands;
  param: string;
  message: DiscordMessage;
}

export enum Status {
  'Planned' = 1,
  'Running' = 2,
  'Stopped' = 3,
  'Closed' = 4,
};

export type Op = {
  status: Status,
  events: Array<GainExperienceDto | DeathDto>,
  baseCaptures: Array<FacilityVM>,
  voiceChannels: Array<VoiceChannel>,
  soloReports: Array<{ user: User, characterId: string }>,
  stop: (op: Op) => Promise<void>,
  close: (op: Op) => Promise<void>,
  sendSoloReport: (soloReport: { user: User, characterId: string }) => Promise<void>,
};

export type Training = {
  voiceChannels: Array<VoiceChannel>,
  participantIds: Array<string>,
  stop: (training: Training)=>void,
};

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