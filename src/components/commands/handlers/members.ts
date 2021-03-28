import { Command } from '../types';
import { consoleCatch } from '../../../utils';
import { ps2RestClient } from '../../../app';
import { MessageEmbed } from 'discord.js';

export async function MembersCommandHandler (command: Command): Promise<void> {
  if (!command.discordMessage) throw('Unexpected MembersCommandHandler command.discordMessage null');

  const aliasLookup = command.param || 'BJay';

  command.discordMessage.channel.startTyping();

  const outfit = await ps2RestClient.getOutfit({outfitAlias: aliasLookup}).catch(consoleCatch);
  if (!outfit) {
    await command.discordMessage.channel.send(`[${aliasLookup}] not found.`);
    command.discordMessage.channel.stopTyping();
    return;
  }

  const embed = new MessageEmbed()
    .setTitle(`[${outfit.alias}] ${outfit.name}`)
    .setURL(`https://ps2.fisu.pw/outfit/?name=${outfit.alias}`)
    .addField('Total members', `${outfit.memberCount}`, true)
    .addField('Leader', `${outfit.leader}`, true);

  if (outfit.faction.color) {
    embed.setColor(outfit.faction.color);
  }

  await command.discordMessage.channel.send(embed);
  command.discordMessage.channel.stopTyping();
};
