import { SignupTemplate } from "./types";

const config = require('../ps2discord.json');

export const PS2ApiToken = config.ps2.apiToken;
export const PS2MainOutfitId = config.ps2.outfitId;

export enum Commands {
  'Help' = 'help',
  'Members' = 'members',
  'Online' = 'online',
  'Bases' = 'bases',
  'Op' = 'op',
  'Training' = 'training',
}

export enum Activities {
  'Op' = 'op',
  'Training' = 'training',
}

// WIP Signups code
export enum OpsRole {
  'Heavy' = 'Heavy',
  'Medic' = 'Medic',
  'Engineer' = 'Engineer',
  'Swapper' = 'Swapper',
  'Infiltrator' = 'Infiltrator',

  'Lightning' = 'Lightning',

  'Fill' = 'Fill',
};

export enum RoleTemplates {
  'Standard' = 'standard',
  'Lightning' = 'lightning',
};

export const roleTemplates : Record<RoleTemplates, SignupTemplate> = {
  standard : {
    description: 'Standard BJay squad, you know how it works.',
    roleTemplate: {
      'Heavy': 5,
      'Medic': 4,
      'Swapper': 1,
      'Engineer': 1,
      'Infiltrator': 1,

      'Lightning': 0,
      'Fill': 0,
    },
  },
  lightning: {
    description: `Wait, it's all lightnings? Always has been.`,
    roleTemplate: {
      'Lightning': 12,

      'Heavy': 0,
      'Medic': 0,
      'Swapper': 0,
      'Engineer': 0,
      'Infiltrator': 0,
      'Fill': 0,
    },
  }
};
////

export const DiscordBotToken = config.discordBot.token;
export const DiscordGuildId = config.discordGuild.guildId;
export const DiscordChannelIdRules = config.discordGuild.channelIdRules;
export const DiscordChannelIdWelcome = config.discordGuild.channelIdWelcome;
export const DiscordChannelIdOutfit = config.discordGuild.channelIdOutfit;
export const DiscordChannelIdFacility = config.discordGuild.channelIdFacility;
export const DiscordCategoryIdOps = config.discordGuild.categoryIdOps;
export const DiscordChannelIdOpsLobby = config.discordGuild.channelIdOpsLobby;
export const DiscordChannelIdOps = config.discordGuild.channelIdOps;
export const DiscordChannelIdMentoring = config.discordGuild.channelIdMentoring;
export const DiscordRoleIdLeader = config.discordGuild.roleIdLeader;
export const DiscordRoleIdOfficer = config.discordGuild.roleIdOfficer;
export const DiscordRoleIdSpecialist = config.discordGuild.roleIdSpecialist;
export const DiscordRoleIdMember = config.discordGuild.roleIdMember;
export const DiscordCategoryIdSignups = config.discordGuild.categoryIdSignups;
