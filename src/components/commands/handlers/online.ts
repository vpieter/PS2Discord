import { Command } from '../types';
import { consoleCatch } from '../../../utils';
import { ps2RestClient } from '../../../app';
import { MessageEmbed } from 'discord.js';

export async function OnlineCommandHandler (command: Command): Promise<void> {
  const aliasLookup = command.param || 'BJay';

  command.message.channel.startTyping();

  const onlineOutfit = await ps2RestClient.getOnlineOutfit({outfitAlias: aliasLookup}).catch(consoleCatch);
  if (!onlineOutfit) {
    await command.message.channel.send(`[${aliasLookup}] not found.`);
    command.message.channel.stopTyping();
    return;
  }

  const onlineMembersString = onlineOutfit.onlineMembers
    .sort((a, b) => a.localeCompare(b, undefined, {ignorePunctuation: true}))
    .join(', ');

  const embed = new MessageEmbed()
    .setTitle(`[${onlineOutfit.alias}] ${onlineOutfit.name}`)
    .setURL(`https://ps2.fisu.pw/outfit/?name=${onlineOutfit.alias}`)
    .addField('Online members', `${onlineOutfit.onlineMembers.length}`, true)
    .addField('Total members', `${onlineOutfit.memberCount}`, true)
    .addField('Leader', `${onlineOutfit.leader}`, true);

  if (onlineOutfit.onlineMembers.length) {
    embed.setDescription(`${onlineMembersString}`);
  }
  if (onlineOutfit.faction.color) {
    embed.setColor(onlineOutfit.faction.color);
  }

  await command.message.channel.send(embed);
  command.message.channel.stopTyping();
};
