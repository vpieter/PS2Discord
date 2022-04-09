import { Command } from '../types';
import { Commands } from '../commands';
import { DiscordChannelIdOutfit, DiscordChannelIdFacility } from '../../../consts';
import { discordBotUser, ps2MainOutfit } from '../../../app'

export async function HelpCommandHandler (command: Command): Promise<void> {
  if (!command.discordMessage) throw('Unexpected HelpCommandHandler command.discordMessage null');

  switch (command.param) {
    case Commands.Help: {
      command.discordMessage.channel.send(`What the fuck...`);
      break;
    }

    case Commands.Members: {
      command.discordMessage.channel.send(`The bot will post the number of players that are currently member of an outfit, for example: _<@!${discordBotUser.id}> members 91AR_.`);
      break;
    }

    case Commands.Online: {
      command.discordMessage.channel.send(`The bot will post a list of currently online BJay members in the channel.`
      + `\nYou optionally add an outfit tag to the command to show another outfit's online members, for example: _<@!${discordBotUser.id}> online macs_.`);
      break;
    }

    case Commands.Bases: {
      command.discordMessage.channel.send(`The bot will post a list of bases currently controlled by BJay in the channel.`);
      break;
    }

    case Commands.Op: {
      command.discordMessage.channel.send(`Members can use this command during an op to sign up for an individual op report via DM with the bot, for example: _op potterv_`);
      break;
    }

    case null: {
      command.discordMessage.channel.send(`This bot will show you how many ${ps2MainOutfit?.alias ?? 'outfit'} members are currently logged in on its discord status and show the list of online players in the <#${DiscordChannelIdOutfit}> topic.`
      + `\nIt will also post base capture messages in the <#${DiscordChannelIdFacility}> channel and list bases currently controlled by BJay in the <#${DiscordChannelIdFacility}> topic.`
      + `\n`
      + `\nYou can also give commands to the bot, for example: _<@!${discordBotUser.id}> help online_`
      + `\nThis works in channels where the bot is present, but also in direct messages with the bot.`
      + `\nThis bot was made by <@101347311627534336>, send a message in case of questions or remarks.`
      + `\n`
      + `\n**available commands:**`
      + `\nhelp (command)`
      + `\nmembers (outfit alias)`
      + `\nonline (outfit alias)`
      + `\nbases`
      + `\nop (character name)`);
      break;
    }

    default: {
      command.discordMessage.channel.send(`Cannot provide help for unknown command "${command.param}".`);
    }
  }
}
