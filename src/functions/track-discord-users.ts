import { Guild, GuildMember, PartialGuildMember, VoiceState } from 'discord.js';
import { DateTime } from 'luxon';
import { discordClient, koa, trackedDiscordUsers } from '../app';
import { DiscordRoleIdMember } from '../consts';
import { TrackedDiscordUser } from '../types';

export async function trackDiscordUsers(): Promise<void> {
  const startTime = DateTime.local();
  const emptyTrackedDiscordUser: TrackedDiscordUser = { id: '', username: '', displayName: '', displayNameHistory: [], member: false, role: '', voiceHistory: [] };

  // internal functions
  const voiceStatusUpdateListener = async (oldState: VoiceState, newState: VoiceState) => {
    if (newState.channelID === null || newState.member === null) return;

    trackedDiscordUsers[newState.member.user.id] = {
      ...emptyTrackedDiscordUser,
      ...trackedDiscordUsers[newState.member.id],
      id: newState.member.user.id,
      username: newState.member.user.username,
      displayName: newState.member.displayName,
      member: newState.member.roles.cache.has(DiscordRoleIdMember),
      role: newState.member.roles.hoist?.name || 'n/a',
      voiceHistory: [
        {
          date: DateTime.local(),
          channelName: newState.channel?.name || '',
        },
        ...(trackedDiscordUsers[newState.member.id]?.voiceHistory || []),
      ].slice(0,3),
    };
  };

  const guildMemberUpdateListener = async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    if (newMember.id === null) return;

    trackedDiscordUsers[newMember.user.id] = {
      ...emptyTrackedDiscordUser,
      ...trackedDiscordUsers[newMember.id],
      id: newMember.user.id,
      username: newMember.user.username,
      displayName: newMember.displayName,
      displayNameHistory: [
        ...(oldMember.displayName !== newMember.displayName ? [{date:DateTime.local(), displayName:newMember.displayName}] : []),
        ...(trackedDiscordUsers[newMember.id]?.displayNameHistory || []),
      ].slice(0,3),
      member: newMember.roles.cache.has(DiscordRoleIdMember),
      role: newMember.roles.hoist?.name || 'n/a',
    };
  };

  const start = async function(): Promise<void> {
    discordClient.on('voiceStateUpdate', voiceStatusUpdateListener);
    discordClient.on('guildMemberUpdate', guildMemberUpdateListener);
    koa.debugExpose('trackDiscordUsers-start', async () => startTime);
  };

  await start();
};
