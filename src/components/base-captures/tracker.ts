import { Client as DiscordClient, Message, MessageEmbed, TextChannel } from 'discord.js';
import { debounce, remove, some } from 'lodash';
import { OpTracker } from '..';
import { ps2ControlledBases, ps2MainOutfit, ps2RestClient, runningActivities } from '../../app';
import { Activities, DiscordChannelIdFacility } from '../../consts';
import { FacilityVM } from '../../ps2-rest-client/types';
import { PS2StreamingClient } from '../../ps2-streaming-client';
import { PS2StreamingEvent } from '../../ps2-streaming-client/consts';
import { ContinentLockDTO, FacilityControlDTO, PlayerFacilityDto, PS2StreamingLookup } from '../../ps2-streaming-client/types';
import { consoleCatch, wait } from '../../utils';

export class BaseCapturesTracker {
  private _started: boolean = false;
  private _readyPromise: Promise<this>;
  private _ps2StreamingClientWorld: PS2StreamingClient | null = null;
  private _ps2StreamingClientCharacters: PS2StreamingClient | null = null;
  private _discordClient: DiscordClient;
  private _ps2ControlledBaseMessages: Record<string, Message> = {};
  private _resetListenersInterval: NodeJS.Timeout | null = null;

  get ready(): Promise<this> {
    if (this._ps2StreamingClientWorld !== null && this._ps2StreamingClientCharacters) return new Promise(resolve => resolve(this));
    return this._readyPromise;
  }

  get started(): boolean {
    return this._started;
  }

  constructor(discordClient: DiscordClient) {
    this._discordClient = discordClient;
    this._readyPromise = Promise.all([
      PS2StreamingClient.getInstance().then(client => {
        this._ps2StreamingClientWorld = client;
        return this;
      }),
      PS2StreamingClient.getInstance().then(client => {
        this._ps2StreamingClientCharacters = client;
        return this;
      }),
    ]).then(() => this);
  }

  async start() {
    if (this.started) return;
    if (this._ps2StreamingClientWorld === null || this._ps2StreamingClientCharacters === null) {
      await this.ready.then(async () => await this.start());
      return;
    }

    await this._output();
    await this._startListeners();
    this._resetListenersInterval = setInterval(this._resetListeners, 1000 * 60 * 30);

    this._started = true;
  }

  async stop() {
    if (!this.started) return;
    if (!this._resetListenersInterval) throw('Unexpected base-captures _resetListenersInterval null.');

    clearInterval(this._resetListenersInterval);
    this._resetListenersInterval = null;
    await this._stopListeners();
    this._started = false;
  }

  // private getter
  private get _playerFacilityCapturePS2StreamingLookup(): PS2StreamingLookup {
    return { characters: ps2MainOutfit.members.map(member => member.id) };
  }

  // private methods
  private _output = async () => {
    await Promise.all([
      this._setOutfitTopic(),
    ]);
  }

  private _mainOutfitBaseCaptures = async (facilityDto: FacilityControlDTO) => {
    const facility = await ps2RestClient.getFacility(facilityDto.facility_id).catch(consoleCatch);
    if (!facility) return;

    const contributors: Array<string> = [];
    ps2ControlledBases.push({...facility, contributors});

    const runningOp = runningActivities[Activities.Op] as OpTracker;
    if (runningOp) await runningOp.addBaseCapture(facility);

    const message = await this._sendBaseCaptureMessage(facility).catch(consoleCatch);
    if (!message) return;

    this._ps2ControlledBaseMessages[facility.id] = message;
    wait(5000).then(() => {
      this._setBaseCaptureMessageContributors(message, contributors).catch(consoleCatch);
    });

    await this._setBaseCapturesTopic()?.catch(consoleCatch);
  }

  private _mainOutfitCharactersBaseCaptures = async (playerFacilityCaptureDto: PlayerFacilityDto) => {
    // Try 10 times to add capture contribution to an outfit capture.
    // Most times the outfit won't have captured the base and this repeats 10 tries and stops.
    let i = 0;
    const intervalID = setInterval(() => {
      if (i++ === 10) clearInterval(intervalID); // 

      // Maybe the FacilityControl event hasn't come in/been handled yet.
      const controlledBase = ps2ControlledBases.find(base => base.id === playerFacilityCaptureDto.facility_id);
      if (!controlledBase) return;

      // In case someone has recently left the outfit this guard might be hit.
      const contributor = ps2MainOutfit.members.find(member => member.id === playerFacilityCaptureDto.character_id);
      if (!contributor) return;

      // Don't handle duplicate events from the unreliable PS2 API.
      const isNewContributor = !controlledBase.contributors.find(characterId => characterId === playerFacilityCaptureDto.character_id);
      if (isNewContributor) {
        controlledBase.contributors.push(contributor.name);
      }

      clearInterval(intervalID);
    }, 300);
  }

  private _mainOutfitBaseLosses = async (facilityDto: FacilityControlDTO) => {
    remove(ps2ControlledBases, facility => facility.id === facilityDto.facility_id);

    await this._setBaseCapturesTopic()?.catch(consoleCatch);
  }

  private _continentLocks = async (zoneId: string) => {
    remove(ps2ControlledBases, facility => facility.zone.id === zoneId);
    await this._setBaseCapturesTopic()?.catch(consoleCatch);
  }

  private _sendBaseCaptureMessage = async (facility: FacilityVM): Promise<Message> => {
    const embed = new MessageEmbed()
      .setTitle(`${ps2MainOutfit.alias} captured ${facility.name}`)
      .addField('Continent', `${facility.zone.name}`, true)
      .addField('Type', `${facility.type}`, true);

    const channel = await this._discordClient.channels.fetch(DiscordChannelIdFacility);
    if (channel.type !== 'text') throw(`Cannot send base capture message in non-text channel (${channel.id}).`);

    return await (channel as TextChannel).send(embed);
  }

  private _setBaseCaptureMessageContributors = async (message: Message, contributors: Array<string>): Promise<Message> => {
    if (message.embeds.length === 0) return Promise.reject('updateBaseCaptureEmbed() embed not found.');

    const embed = new MessageEmbed({...message.embeds[0]} as MessageEmbed);
    embed.addField('Contributors', `${contributors.length}`, true);
    embed.setDescription(contributors.sort((a,b)=>a.localeCompare(b)).join(', '));
    return await message.edit(embed);
  };

  private _setBaseCapturesTopic = debounce(
    async () => {
      const basesText = ps2ControlledBases.length ?
        ps2ControlledBases.map(facility => `${facility.name}`).join(', ') :
        'no bases :(';
      let topicText = `${ps2MainOutfit.alias} currently controls: ${basesText}`;
      if (topicText.length > 1024) {
        topicText = `${topicText.substring(0, 1021)}...`;
      }

      const channel = await this._discordClient.channels.fetch(DiscordChannelIdFacility);
      if (channel.type !== 'text') throw(`Cannot set base captures topic in non-text channel (${channel.id}).`);

      await (channel as TextChannel).setTopic(topicText);
    },
    5*60*1000,
    { leading: true, maxWait: 15*60*1000, trailing: true }
  );

  private _resetListeners = async () => {
    if (!this.started) return;

    await this._stopListeners();
    await wait(800);
    await this._startListeners();
  }

  private _startListeners = async () => {
    if (this._ps2StreamingClientWorld === null || this._ps2StreamingClientCharacters === null) return;

    // Subscribe to main outfit base captures
    this._ps2StreamingClientWorld.subscribe(PS2StreamingEvent.FacilityControl, async data => {
      const facilityDto = data as FacilityControlDTO;
      if (facilityDto.outfit_id !== ps2MainOutfit.id) return;
      if (facilityDto.old_faction_id === ps2MainOutfit.faction.id) return;

      await this._mainOutfitBaseCaptures(facilityDto);
    });

    // Subscribe to main outfit losing bases
    this._ps2StreamingClientWorld.subscribe(PS2StreamingEvent.FacilityControl, async data => {
      const facilityDto = data as FacilityControlDTO;
      if (facilityDto.new_faction_id === ps2MainOutfit.faction.id) return;
      if (!some(ps2ControlledBases, facility => facility.id === facilityDto.facility_id)) return;

      await this._mainOutfitBaseLosses(facilityDto);
    });

    // Subscribe to continent locks (= losing control of bases)
    this._ps2StreamingClientWorld.subscribe(PS2StreamingEvent.ContinentLock, async data => {
      const continentLockDTO = data as ContinentLockDTO;

      await this._continentLocks(continentLockDTO.zone_id);
    });

    // Subscribe to main outfit characters getting facility capture XP
    this._ps2StreamingClientCharacters.subscribe(PS2StreamingEvent.PlayerFacilityCapture, async data => {
      const playerFacilityCaptureDto = data as PlayerFacilityDto;
      if (playerFacilityCaptureDto.outfit_id !== ps2MainOutfit.id) return;

      await this._mainOutfitCharactersBaseCaptures(playerFacilityCaptureDto);
    }, this._playerFacilityCapturePS2StreamingLookup);
  }

  private _stopListeners = async () => {
    if (this._ps2StreamingClientWorld === null || this._ps2StreamingClientCharacters === null) return;

    this._ps2StreamingClientWorld.unsubscribe(PS2StreamingEvent.FacilityControl);
    this._ps2StreamingClientWorld.unsubscribe(PS2StreamingEvent.ContinentLock);
    this._ps2StreamingClientCharacters.unsubscribe(PS2StreamingEvent.PlayerFacilityCapture, { characters: ['all'] });
  }

  private _setOutfitTopic = debounce(
    async () => {
      const basesText = ps2ControlledBases.length ?
        ps2ControlledBases.map(facility => `${facility.name}`).join(', ') :
        'no bases :(';
      let topicText = `${ps2MainOutfit.alias} currently controls: ${basesText}`;
      if (topicText.length > 1024) {
        topicText = `${topicText.substring(0, 1021)}...`;
      }

      const channel = await this._discordClient.channels.fetch(DiscordChannelIdFacility);
      if (channel.type !== 'text') throw(`Cannot set base captures topic in non-text channel (${channel.id}).`);

      return await (channel as TextChannel).setTopic(topicText);
    },
    5*60*1000,
    { leading: true, maxWait: 15*60*1000, trailing: true }
  );
}
