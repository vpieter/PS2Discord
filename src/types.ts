import { Commands, OpsRole, RoleTemplates } from './consts';
import { Message as DiscordMessage, Message, User, VoiceChannel } from 'discord.js';
import { DeathDto, GainExperienceDto } from './ps2-streaming-client/types';
import { FacilityVM } from './ps2-rest-client/types';

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
  stop: (training: Training)=>void,
};

export type SignupChannel = {
  title: string,
  description: string,
  date: string,
  time: string,
  embedMessage: Message,
  templates: RoleTemplates[],
  signups: Record<string, OpsRole | null>,
  altSignups: Record<string, OpsRole[]>,
};

export type SignupTemplate = {
  description: string,
  roleTemplate: Record<OpsRole, number>,
};
