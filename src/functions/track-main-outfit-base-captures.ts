import { discordClient, ps2ControlledBases, ps2MainOutfit, ps2RestClient, runningActivities } from '../app';
import { Activities, DiscordChannelIdFacility } from '../consts';
import { PS2StreamingEvent } from '../ps2-streaming-client/consts';
import { FacilityVM } from '../ps2-rest-client/types';
import { FacilityControlDTO, ContinentLockDTO, PlayerFacilityDto } from '../ps2-streaming-client/types';
import { PS2StreamingClient } from '../ps2-streaming-client';
import { debounce, remove, some } from 'lodash';
import { TextChannel, MessageEmbed, Message } from 'discord.js';
import { consoleCatch, wait } from '../utils';
import { Op, Status } from '../types';

const ps2ControlledBaseMessages: Record<string, Message> = {};
const debouncedSetBaseCapturesTopic = debounce(async () => {await setBaseCapturesTopic()}, 5*60*1000, { leading: true, maxWait: 15*60*1000, trailing: true });

export async function trackMainOutfitBaseCaptures(): Promise<void> {
  await debouncedSetBaseCapturesTopic()?.catch(consoleCatch);

  const ps2StreamingClientWorld = await PS2StreamingClient.getInstance();
  const ps2StreamingClientCharacters = await PS2StreamingClient.getInstance();

  // internal functions
  const initializeTrackMainWorld = () => {
    ps2StreamingClientWorld.subscribe(PS2StreamingEvent.FacilityControl, async data => {
      const facilityDTO = data as FacilityControlDTO;
      if (facilityDTO.outfit_id !== ps2MainOutfit.id) return;
      if (facilityDTO.old_faction_id === ps2MainOutfit.faction.id) return;

      const channel = await discordClient.channels.fetch(DiscordChannelIdFacility);
      if (channel.type !== 'text') throw(`Cannot post base capture messages in non-text channel (${channel.id}).`);

      const facility = await ps2RestClient.getFacility(facilityDTO.facility_id).catch(consoleCatch);
      if (!facility) return;
      const contributors: Array<string> = [];
      ps2ControlledBases.push({...facility, contributors});

      const runningOp = runningActivities[Activities.Op] as Op;
      if (runningOp && runningOp.status <= Status.Started) runningOp.baseCaptures.push(facility);

      const message = await sendBaseCaptureMessage(facility).catch(consoleCatch);
      if (!message) return;
      ps2ControlledBaseMessages[facility.id] = message;
      wait(8000).then(()=>{
        setBaseCaptureMessageContributors(message, contributors).catch(consoleCatch);
      });

      await debouncedSetBaseCapturesTopic()?.catch(consoleCatch);
    });

    ps2StreamingClientWorld.subscribe(PS2StreamingEvent.FacilityControl, async data => {
      const facilityDTO = data as FacilityControlDTO;
      if (facilityDTO.new_faction_id === ps2MainOutfit.faction.id) return;
      if (!some(ps2ControlledBases, facility => facility.id === facilityDTO.facility_id)) return;

      remove(ps2ControlledBases, facility => facility.id === facilityDTO.facility_id);

      await debouncedSetBaseCapturesTopic()?.catch(consoleCatch);
    });

    ps2StreamingClientWorld.subscribe(PS2StreamingEvent.ContinentLock, async data => {
      const continentLockDTO = data as ContinentLockDTO;

      remove(ps2ControlledBases, facility => facility.zone.id === continentLockDTO.zone_id);
      await debouncedSetBaseCapturesTopic()?.catch(consoleCatch);
    });
  };

  const initializeTrackMainOutfitMembers = () => {
    ps2StreamingClientCharacters.subscribe(PS2StreamingEvent.PlayerFacilityCapture, async data => {
      const playerFacilityCaptureDTO = data as PlayerFacilityDto;
      if (playerFacilityCaptureDTO.outfit_id !== ps2MainOutfit.id) return;

      let i = 0;
      const intervalID = setInterval(()=>{
        if (i++ === 10) clearInterval(intervalID);

        const controlledBase = ps2ControlledBases.find(base => base.id === playerFacilityCaptureDTO.facility_id);
        if (!controlledBase) return;

        const newContributor = !controlledBase.contributors.find(characterID => characterID === playerFacilityCaptureDTO.character_id);
        if (newContributor) {
          const contributor = ps2MainOutfit.members.find(member => member.id === playerFacilityCaptureDTO.character_id);
          if (!contributor) return;

          controlledBase.contributors.push(contributor.name);
        }

        clearInterval(intervalID);
      }, 1000,);
    }, { characters: ps2MainOutfit.members.map(member => member.id) });
  };

  const reinitializeTrackMainWorld = async () => {
    ps2StreamingClientWorld.unsubscribe(PS2StreamingEvent.FacilityControl);
    await wait(200);
    initializeTrackMainWorld();
  };

  const reinitializeTrackMainOutfitMembers = async () => {
    ps2StreamingClientCharacters.unsubscribe(PS2StreamingEvent.PlayerFacilityCapture, { characters: ['all'] });
    await wait(200);
    initializeTrackMainOutfitMembers();
  };

  // trackMainOutfitBaseCaptures
  initializeTrackMainWorld();
  initializeTrackMainOutfitMembers();
  setInterval(reinitializeTrackMainWorld, 1000 * 60 * 60);
  setInterval(reinitializeTrackMainOutfitMembers, 1000 * 60 * 60);

  return Promise.resolve();
};

async function sendBaseCaptureMessage(facility: FacilityVM): Promise<Message> {
  const embed = new MessageEmbed()
    .setTitle(`${ps2MainOutfit.alias} captured ${facility.name}`)
    .addField('Continent', `${facility.zone.name}`, true)
    .addField('Type', `${facility.type}`, true);

  const channel = await discordClient.channels.fetch(DiscordChannelIdFacility);
  if (channel.type !== 'text') throw(`Cannot send base capture message in non-text channel (${channel.id}).`);

  return await (channel as TextChannel).send(embed);
};

async function setBaseCaptureMessageContributors(message: Message, contributors: Array<string>): Promise<Message> {
  if (message.embeds.length === 0) return Promise.reject('updateBaseCaptureEmbed() embed not found.');

  const embed = new MessageEmbed({...message.embeds[0]} as MessageEmbed);
  embed.addField('Contributors', `${contributors.length}`, true);
  embed.setDescription(contributors.sort((a,b)=>a.localeCompare(b)).join(', '));
  return await message.edit(embed);
};

async function setBaseCapturesTopic(): Promise<TextChannel> {
  const basesText = ps2ControlledBases.length ?
    ps2ControlledBases.map(facility => `${facility.name}`).join(', ') :
    'no bases :(';
  let topicText = `${ps2MainOutfit.alias} currently controls: ${basesText}`;
  if (topicText.length > 1024) {
    topicText = `${topicText.substring(0, 1021)}...`;
  }

  const channel = await discordClient.channels.fetch(DiscordChannelIdFacility);
  if (channel.type !== 'text') throw(`Cannot set base captures topic in non-text channel (${channel.id}).`);

  return await (channel as TextChannel).setTopic(topicText);
};
