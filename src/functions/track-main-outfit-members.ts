import { discordBotUser, discordClient, ps2MainOutfit, ps2RestClient } from '../app';
import { DiscordChannelIdOutfit } from '../consts';
import { PS2StreamingEvent } from '../ps2-streaming-client/consts';
import { PlayerLogDTO } from '../ps2-streaming-client/types';
import { PS2StreamingClient } from '../ps2-streaming-client';
import { debounce, extend, isNil } from 'lodash';
import { TextChannel, Presence } from 'discord.js';
import { consoleCatch, wait } from '../utils';

const debouncedSetOutfitTopic = debounce(async () => {await setOutfitTopic()}, 5*60*1000, { leading: true, maxWait: 15*60*1000, trailing: true });

export async function trackMainOutfitMembersOnline(): Promise<void> {
  const ps2StreamingClient = await PS2StreamingClient.getInstance();

  // internal functions
  const actions = async () => {
    await setDiscordPresence().catch(consoleCatch);
    await debouncedSetOutfitTopic()?.catch(consoleCatch);
  };

  const initializeTrackMainOutfitMembers = () => {
    ps2StreamingClient.subscribe(PS2StreamingEvent.PlayerLogin, async data => {
      const playerLoginDTO = data as PlayerLogDTO;
      const member = ps2MainOutfit.members.find(member => member.id === playerLoginDTO.character_id);
      if (!member) throw('PlayerLogin member id not found.');

      member.online = true;
      await actions();
    }, { characters: ps2MainOutfit.members.map(member => member.id) });

    ps2StreamingClient.subscribe(PS2StreamingEvent.PlayerLogout, async data => {
      const playerLogoutDTO = data as PlayerLogDTO;
      const member = ps2MainOutfit.members.find(member => member.id === playerLogoutDTO.character_id);
      if (!member) throw('PlayerLogout member id not found.');

      member.online = false;
      await actions();
    }, { characters: ps2MainOutfit.members.map(member => member.id) });
  };

  const reinitializeTrackMainOutfitMembers = async () => {
    ps2StreamingClient.unsubscribe(PS2StreamingEvent.PlayerLogin, { characters: ['all'] });
    await wait(200);
    ps2StreamingClient.unsubscribe(PS2StreamingEvent.PlayerLogout, { characters: ['all'] });
    await wait(800);
    initializeTrackMainOutfitMembers();

    await ps2RestClient.getMainOutfit()
      .then(mainOutfit => {
        if (isNil(mainOutfit?.faction?.id) || isNil(mainOutfit?.members[0]?.id)) return;

        extend(ps2MainOutfit, mainOutfit);
      })
      .catch(consoleCatch);
    await wait(200);
    await actions();
  };

  // trackMainOutfitMembers
  await actions();
  initializeTrackMainOutfitMembers();
  setInterval(reinitializeTrackMainOutfitMembers, 1000 * 60 * 30);

  return Promise.resolve();
};

async function setDiscordPresence(): Promise<Presence> {
  return await discordBotUser.setPresence({
    activity: {
      type: 'WATCHING',
      name: `${ps2MainOutfit.members.filter(member => member.online).length}/${ps2MainOutfit.memberCount} BJay gays play`
    },
    status: 'online',
  });
};

async function setOutfitTopic(): Promise<TextChannel> {
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

  const channel = await discordClient.channels.fetch(DiscordChannelIdOutfit);
  if (channel.type !== 'text') throw(`Cannot set outfit topic in non-text channel (${channel.id}).`);

  return await (channel as TextChannel).setTopic(topicText);
};
