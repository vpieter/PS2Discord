import { Client as DiscordClient, TextChannel } from 'discord.js';
import { debounce } from 'lodash';
import { ps2MainOutfit } from '../../app';
import { DiscordChannelIdOutfit } from '../../consts';
import { PS2StreamingClient } from '../../ps2-streaming-client';
import { PS2StreamingEvent } from '../../ps2-streaming-client/consts';
import { PlayerLogDTO, PS2StreamingEventListenerFn, PS2StreamingLookup } from '../../ps2-streaming-client/types';
import { wait } from '../../utils';

export class MembersOnlineTracker {
  private _started: boolean = false;
  private _readyPromise: Promise<this>;
  private _ps2StreamingClient: PS2StreamingClient | null = null;
  private _discordClient: DiscordClient;

  get ready(): Promise<this> {
    if (this._ps2StreamingClient !== null) return new Promise(resolve => resolve(this));
    return this._readyPromise;
  }

  get started(): boolean {
    return this._started;
  }

  constructor(discordClient: DiscordClient) {
    this._discordClient = discordClient;
    this._readyPromise = PS2StreamingClient.getInstance().then(client => {
      this._ps2StreamingClient = client;
      return this;
    });
  }

  async start() {
    if (this.started) return;
    if (this._ps2StreamingClient === null) {
      await this.ready.then(async () => await this.start());
      return;
    }

    await this._output();
    await this._startListeners();
    setInterval(this._resetListeners, 1000 * 60 * 30);

    this._started = true;
  }

  async stop() {
    if (!this.started) return;

    await this._stopListeners();
    this._started = false;
  }

  // private getter
  private get _playerLogPS2StreamingLookup(): PS2StreamingLookup {
    return { characters: ps2MainOutfit.members.map(member => member.id) };
  }

  // private methods
  private _output = async () => {
    await Promise.all([
      this._setDiscordPresence(),
      this._setOutfitTopic(),
    ]);
  }

  private _resetListeners = async () => {
    if (!this.started) return;

    await this._stopListeners();
    await wait(800);
    await this._startListeners();
  }

  private _startListeners = async () => {
    if (this._ps2StreamingClient === null) return;

    this._ps2StreamingClient.subscribe(PS2StreamingEvent.PlayerLogin, this._playerLogListener, this._playerLogPS2StreamingLookup);
    this._ps2StreamingClient.subscribe(PS2StreamingEvent.PlayerLogout, this._playerLogListener, this._playerLogPS2StreamingLookup);
  }

  private _stopListeners = async () => {
    if (this._ps2StreamingClient === null) return;

    this._ps2StreamingClient.unsubscribe(PS2StreamingEvent.PlayerLogin, { characters: ['all'] });
    this._ps2StreamingClient.unsubscribe(PS2StreamingEvent.PlayerLogout, { characters: ['all'] });
  }

  private _playerLogListener: PS2StreamingEventListenerFn = async data => {
    const playerLogDTO = data as PlayerLogDTO;
    const member = ps2MainOutfit.members.find(member => member.id === playerLogDTO.character_id);
    if (!member) throw('PlayerLog member id not found.');

    member.online = (playerLogDTO.event_name === PS2StreamingEvent.PlayerLogin);
    await this._output();
  }

  private _setDiscordPresence = async () => {
    if (this._discordClient.user === null) return;

    this._discordClient.user.setPresence({
      activities: [{
        type: 'WATCHING',
        name: `${ps2MainOutfit.members.filter(member => member.online).length}/${ps2MainOutfit.memberCount} ${ps2MainOutfit.alias} gays play`,
      }],
      status: 'online',
    });
  }
  
  private _setOutfitTopic = debounce(
    async () => {
      const onlineMembers = ps2MainOutfit.members.filter(member => member.online);
      const onlineMembersString = onlineMembers
        .map(member => member.name)
        .sort((a, b) => a.localeCompare(b, undefined, {ignorePunctuation: true}))
        .join(', ');
      let topicText = onlineMembers.length ?
        `:zap: Aliev gaem: ${onlineMembersString} online` :
        `:zzz: No one online. deadfit confirmed.`;
      if (topicText.length > 1024) {
        topicText = `${topicText.substring(0, 1021)}...`;
      }
    
      const channel = await this._discordClient.channels.fetch(DiscordChannelIdOutfit);
      if (!channel) throw(`Unexpected null channel (${DiscordChannelIdOutfit}).`);
      if (channel.type !== 'GUILD_TEXT') throw(`Cannot set outfit topic in non-text channel (${channel.id}).`);
    
      await (channel as TextChannel).setTopic(topicText);
    },
    5*60*1000,
    { leading: true, maxWait: 15*60*1000, trailing: true }
  );
}
