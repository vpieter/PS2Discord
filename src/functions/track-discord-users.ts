import { GuildMember, PartialGuildMember, VoiceState } from 'discord.js';
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

    trackedDiscordUsers.set(newState.member.user.id,
      {
        ...emptyTrackedDiscordUser,
        ...trackedDiscordUsers.get(newState.member.id).value(),
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
          ...(trackedDiscordUsers.get(newState.member.id).value()?.voiceHistory || []),
        ].slice(0,3),
      })
      .save();
  };

  const guildMemberUpdateListener = async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    if (newMember.id === null) return;

    trackedDiscordUsers.set(newMember.user.id,
      {
        ...emptyTrackedDiscordUser,
        ...trackedDiscordUsers.get(newMember.id).value(),
        id: newMember.user.id,
        username: newMember.user.username,
        displayName: newMember.displayName,
        displayNameHistory: [
          ...(oldMember.displayName !== newMember.displayName ? [{date:DateTime.local(), displayName:newMember.displayName}] : []),
          ...(trackedDiscordUsers.get(newMember.id).value()?.displayNameHistory || []),
        ].slice(0,3),
        member: newMember.roles.cache.has(DiscordRoleIdMember),
        role: newMember.roles.hoist?.name || 'n/a',
      })
      .save();
  };

  const start = async function(): Promise<void> {
    discordClient.on('voiceStateUpdate', voiceStatusUpdateListener);
    discordClient.on('guildMemberUpdate', guildMemberUpdateListener);

    koa.debugExpose('trackDiscordUsers-start', async () => startTime);
  };

  await start();
};
