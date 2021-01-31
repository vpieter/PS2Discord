import { consoleCatch } from '../utils';
import { Command } from '../types';
import { ps2RestClient } from '../app';
import { MessageEmbed } from 'discord.js';

export async function MembersCommandHandler (command: Command): Promise<void> {
  const aliasLookup = command.param || 'BJay';

  command.message.channel.startTyping();

  const outfit = await ps2RestClient.getOutfit({outfitAlias: aliasLookup}).catch(consoleCatch);
  if (!outfit) {
    await command.message.channel.send(`[${aliasLookup}] not found.`);
    command.message.channel.stopTyping();
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

  await command.message.channel.send(embed);
  command.message.channel.stopTyping();
};
