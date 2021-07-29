import { Command } from '../types';
import { consoleCatch } from '../../../utils';
import { ps2MainOutfit, ps2RestClient } from '../../../app';
import { HexColorString, MessageEmbed } from 'discord.js';

export async function OnlineCommandHandler (command: Command): Promise<void> {
  console.log('online', command);
  if (!command.discordMessage) throw('Unexpected OnlineCommandHandler command.discordMessage null');
  if (command.discordMessage.channel.type !== 'GUILD_TEXT' && command.discordMessage.channel.type !== 'DM') throw('unexpected non-text command channel.');

  const aliasLookup = command.param || ps2MainOutfit.alias || 'BJay';

  command.discordMessage.channel.sendTyping();

  const onlineOutfit = await ps2RestClient.getOnlineOutfit({outfitAlias: aliasLookup}).catch(consoleCatch);
  if (!onlineOutfit) {
    await command.discordMessage.channel.send(`[${aliasLookup}] not found.`);
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
    embed.setColor(`#${onlineOutfit.faction.color}` as HexColorString);
  }

  await command.discordMessage.channel.send({embeds: [embed]});
};
