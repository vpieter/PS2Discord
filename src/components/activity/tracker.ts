import { Client as DiscordClient, GuildMember, PartialGuildMember, VoiceState } from 'discord.js';
import { map, mapValues } from 'lodash';
import { DateTime } from 'luxon';
import { DiscordGuildId, DiscordRoleIdMember } from '../../consts';
import { MyStore } from '../../my-store';
import { getEmptyTrackedDiscordUser, TrackedDiscordUser } from './types';

export class ActivityTracker {
  private _started: boolean = false;
  private _discordClient: DiscordClient;
  private _activityStore: MyStore<TrackedDiscordUser>;

  private _voiceHistoryCount = 5;
  private _displayNameHistoryCount = 5;

  get started(): boolean {
    return this._started;
  }

  get activityStore(): MyStore<TrackedDiscordUser> {
    return this._activityStore;
  }

  constructor(discordClient: DiscordClient) {
    this._discordClient = discordClient;
    this._activityStore = new MyStore<TrackedDiscordUser>('trackedDiscordUsers', temp => {
      // Mapper to handle DateTime parsing
      return mapValues(temp, trackedDiscordUser => ({
        ...trackedDiscordUser,
        voiceHistory: map(trackedDiscordUser.voiceHistory, voiceHistory => ({
          ...voiceHistory,
          date: DateTime.fromISO(voiceHistory.date as any as string),
        })),
      }));
    });
  }

  start() {
    this._discordClient.on('voiceStateUpdate', this._voiceStatusUpdateListener);
    this._discordClient.on('guildMemberUpdate', this._guildMemberUpdateListener);
    this._started = true;
  }

  stop() {
    this._discordClient.removeListener('voiceStateUpdate', this._voiceStatusUpdateListener);
    this._discordClient.removeListener('guildMemberUpdate', this._guildMemberUpdateListener);
    this._started = false;
  }

  // private methods
  private _voiceStatusUpdateListener = async (oldState: VoiceState, newState: VoiceState) => {
    if (newState.guild.id !== DiscordGuildId) return;
    if (newState.channelID === null || newState.member === null) return;

    const existingTrackedDiscordUser = this._activityStore.get(newState.member.id).value();
    const updatedVoiceHistory = [
      {
        date: DateTime.local(),
        channelName: newState.channel?.name || '',
      },
      ...(existingTrackedDiscordUser?.voiceHistory || []),
    ].slice(0, this._voiceHistoryCount);
    const updatedTrackedDiscordUser = {
      ...getEmptyTrackedDiscordUser(),
      ...existingTrackedDiscordUser,
      id: newState.member.user.id,
      username: newState.member.user.username,
      displayName: newState.member.displayName,
      member: newState.member.roles.cache.has(DiscordRoleIdMember),
      role: newState.member.roles.hoist?.name || 'n/a',
      voiceHistory: updatedVoiceHistory,
    };

    this._activityStore.set(newState.member.user.id, updatedTrackedDiscordUser).save();
  }

  private _guildMemberUpdateListener = async (oldMember: GuildMember | PartialGuildMember, newMember: GuildMember) => {
    if (newMember.guild.id !== DiscordGuildId) return;
    if (newMember.id === null) return;

    const existingTrackedDiscordUser = this._activityStore.get(newMember.id).value();
    const updatedDisplayNameHistory = [
      ...(oldMember.displayName !== newMember.displayName ? [{date:DateTime.local(), displayName:newMember.displayName}] : []),
      ...(existingTrackedDiscordUser?.displayNameHistory || []),
    ].slice(0, this._displayNameHistoryCount);
    const updatedTrackedDiscordUser = {
      ...getEmptyTrackedDiscordUser(),
      ...existingTrackedDiscordUser,
      id: newMember.user.id,
      username: newMember.user.username,
      displayName: newMember.displayName,
      displayNameHistory: updatedDisplayNameHistory,
      member: newMember.roles.cache.has(DiscordRoleIdMember),
      role: newMember.roles.hoist?.name || 'n/a',
    };

    this._activityStore.set(newMember.user.id, updatedTrackedDiscordUser).save();
  }
}
