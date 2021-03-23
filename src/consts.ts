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
  // 'Activity' = 'activity',
};

export enum Activities {
  'Op' = 'op',
  'Training' = 'training',
};

export const DiscordBotToken = config.discordBot.token;
export const DiscordBotAppClient = config.discordBot.appClient;
export const DiscordBotAppSecret = config.discordBot.appSecret;
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

export const KoaHost = config.koa.host;
export const KoaPort = config.koa.port;
export const KoaCookieKeys = config.koa.cookieKeys;
