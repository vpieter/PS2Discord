import { CategoryChannel, Collection, Message, MessageEmbed, TextChannel } from 'discord.js';
import { countBy, each, groupBy, keys, map, omitBy, remove, without } from 'lodash';
import { discordBotUser, discordClient, discordGuild, openSignups } from '../app';
import { DiscordCategoryIdSignups, DiscordRoleIdLeader, DiscordRoleIdMember, DiscordRoleIdOfficer, DiscordRoleIdSpecialist, OpsRole, RoleTemplates, roleTemplates } from '../consts';
import { SignupChannel } from '../types';

export async function trackSignups(): Promise<void> {
  const trackExistingChannels = async() => {
    var signupsCategory = await discordClient.channels.fetch(DiscordCategoryIdSignups, false, true) as CategoryChannel;
    if (!signupsCategory) return;

    var textChannels = signupsCategory.children.filter(channel => channel.type === 'text') as Collection<string, TextChannel>;
    textChannels.each(async channel => {
      var pinnedMessages = await channel.messages.fetchPinned();
      var message = pinnedMessages.find(message => message.author.id === discordBotUser.id && !!message.embeds[0]);
      if (!message) return;

      var embed = message.embeds[0];
      var signup: SignupChannel = {
        title: embed.title as string,
        description: embed.description ?? '',
        date: '',
        time: '',
        embedMessage: message,
        templates: embed.footer?.text?.split(', ').map(templateName => templateName as RoleTemplates) as RoleTemplates[],
        signups: {},
        altSignups: {},
      };

      embed.fields.forEach(field => {
        var isRole = field.name in OpsRole;
        var isAlts = field.name === `Alternative roles`;
        var isDate = field.name === 'Date';
        var isTime = field.name === 'Time';
        if (isRole) {
          var role = field.name as OpsRole;
          var userIds = field.value.split(']')[1].split('<@').map(split => split.replace(/>/g, '').replace(/, /g, '').trim());
          userIds.forEach(userId => {
            var isUserId = userId.length > 0;
            if (isUserId) signup.signups[userId] = role;
          });
        } else if (isAlts) {
          if (field.value !== 'n/a') {
            field.value.split('<@').slice(1).forEach(line => {
              var userId = line.split('>')[0];
              var roles = line.split('>: ')[1].split(', ').map(roleString => roleString.trim() as OpsRole);
  
              signup.altSignups[userId] = roles;
            });
          }
        } else if (isDate) {
          signup.date = field.value;
        } else if (isTime) {
          signup.time = field.value;
        }
      });

      openSignups[channel.id] = signup;
    });
  };

  const trackChannelCreation = async() => {
    discordClient.on('channelCreate', async channel => {
      const signupsCategory = await discordClient.channels.fetch(DiscordCategoryIdSignups, false, true) as CategoryChannel;
      if (!signupsCategory) return;

      const guildChannel = signupsCategory.children.find(c => c.id === channel.id) as TextChannel;
      if (!guildChannel || guildChannel.type !== 'text') return;

      const nameInput = guildChannel.name as string;

      const dateInput = nameInput.split('_')[0].trim();
      console.log(dateInput);
      const yearString = dateInput.split('-')[2];
      const year = +(yearString.length == 2 ? 2000 + yearString : yearString);
      const month = +(dateInput.split('-')[1]) - 1;
      const day = +(dateInput.split('-')[0]);
      const date = new Date(year, month, day);
      console.log(date);
      const dayName = Intl.DateTimeFormat('en-UK', {weekday: 'long'}).format(date);
      await guildChannel.setName(`${dayName}-ops`);

      const templateInput = nameInput.split('_').slice(1);
      let templates = [RoleTemplates.Standard];
      if (templateInput.length && each(templateInput, input => input in RoleTemplates)) {
        templates = templateInput.map(input => input as RoleTemplates);
      }

      const signup: SignupChannel = {
        title: guildChannel.name,
        description: '',
        date: dateInput,
        time: '20 CET',
        embedMessage: (null as any as Message),
        templates: templates,
        signups: {},
        altSignups: {},
      };

      signup.embedMessage = await guildChannel.send(await generateEmbed(signup));
      signup.embedMessage.pin({reason: 'signup form'});
      openSignups[guildChannel.id] = signup;
    });
  };

  const trackSignupMessages = async() => {
    discordClient.on('message', async message => {
      const signup = openSignups[message.channel.id];
      if (!signup) return;

      const userRole = signup.signups[message.author.id];
      if (!signup.altSignups[message.author.id]) signup.altSignups[message.author.id] = [];
      const userAlts = signup.altSignups[message.author.id];

      if (message.type === 'PINS_ADD' && message.author.id === discordBotUser.id) {
        return await message.delete();
      }

      // Permission
      const leaderRole = await discordGuild.roles.fetch(DiscordRoleIdLeader);
      const officerRole = await discordGuild.roles.fetch(DiscordRoleIdOfficer);
      const specialistRole = await discordGuild.roles.fetch(DiscordRoleIdSpecialist);
      const memberRole = await discordGuild.roles.fetch(DiscordRoleIdMember);

      if (message.content.startsWith('title: ')) {
        if (message.author.id !== '101347311627534336' && // potterv override
          !leaderRole?.members.find(member => member.id === message.author.id) &&
          !officerRole?.members.find(member => member.id === message.author.id) &&
          !specialistRole?.members.find(member => member.id === message.author.id)
        ) {
          await message.channel.send('You can\'t use this command (staff only).');
          return;
        }
        signup.title = message.content.replace('title: ', '');
      }

      if (message.content.startsWith('description: ')) {
        if (message.author.id !== '101347311627534336' && // potterv override
          !leaderRole?.members.find(member => member.id === message.author.id) &&
          !officerRole?.members.find(member => member.id === message.author.id) &&
          !specialistRole?.members.find(member => member.id === message.author.id)
        ) {
          await message.channel.send('You can\'t use this command (staff only).');
          return;
        }
        signup.description = message.content.replace('description: ', '');
      }

      if (message.content.startsWith('date: ')) {
        if (message.author.id !== '101347311627534336' && // potterv override
          !leaderRole?.members.find(member => member.id === message.author.id) &&
          !officerRole?.members.find(member => member.id === message.author.id) &&
          !specialistRole?.members.find(member => member.id === message.author.id)
        ) {
          await message.channel.send('You can\'t use this command (staff only).');
          return;
        }
        signup.date = message.content.replace('date: ', '');
      }

      if (message.content.startsWith('time: ')) {
        if (message.author.id !== '101347311627534336' && // potterv override
          !leaderRole?.members.find(member => member.id === message.author.id) &&
          !officerRole?.members.find(member => member.id === message.author.id) &&
          !specialistRole?.members.find(member => member.id === message.author.id)
        ) {
          await message.channel.send('You can\'t use this command (staff only).');
          return;
        }
        signup.time = message.content.replace('time: ', '');
      }

      if (message.content.startsWith('+')) {
        const tempRole = message.content.split('+')[1];
        const role = getRoleFromString(tempRole);
        if (!role || userRole === role) return;

        const roleTemplatesByType = groupBy(signup.templates, template => template);
        each(roleTemplatesByType, roleTemplatesOfType => {
          const signupRoleTemplate = roleTemplates[roleTemplatesOfType[0]].roleTemplate;
          each(signupRoleTemplate, (singleTemplateRoleCount, templateRole) => {
            if (role === (templateRole as OpsRole) && singleTemplateRoleCount > 0) {
              const templateRoleCount = +singleTemplateRoleCount * roleTemplatesOfType.length;
              const roleSignups = countBy(signup.signups, role => role);

              if (((roleSignups[role] ?? 0) < templateRoleCount) && !userRole) {
                remove(userAlts, alt => alt === role);
                signup.signups[message.author.id] = role;
              } else {
                if (!userAlts.find(alt => alt === role)) userAlts.push(role);
              }
            }
          });
        });
        if (role === OpsRole.Fill) {
          if (!userAlts.find(alt => alt === OpsRole.Fill)) userAlts.push(OpsRole.Fill);
        }
      }

      if (message.content.startsWith('-')) {
        const tempRole = message.content.split('-')[1];
        const role = getRoleFromString(tempRole);
        if (!role) return;

        const roleTemplatesByType = groupBy(signup.templates, template => template);
        each(roleTemplatesByType, roleTemplatesOfType => {
          const signupRoleTemplate = roleTemplates[roleTemplatesOfType[0]].roleTemplate;
          each(signupRoleTemplate, (singleTemplateRoleCount, templateRole) => {
            if (role === templateRole) {
              if (userRole === role) signup.signups[message.author.id] = null;
              else {
                remove(userAlts, alt => alt === role);
              }
            }
          });
        });
        if (role === OpsRole.Fill) {
          remove(userAlts, alt => alt === OpsRole.Fill);
        }
      }

      await signup.embedMessage.edit(await generateEmbed(signup));
    });
  };

  const getRoleFromString = (value: string): OpsRole | null => {
    var role: OpsRole | null = null;

    value = without([...value], ' ').join('').toLowerCase();

    if (['ha', 'heavy', 'heavyassault'].includes(value)) role = OpsRole.Heavy;
    if (['cm', 'medic', 'combatmedic'].includes(value)) role = OpsRole.Medic;
    if (['s', 'swap', 'swapper', 'engiheavy', 'heavyengi'].includes(value)) role = OpsRole.Swapper;
    if (['e', 'engi', 'engineer'].includes(value)) role = OpsRole.Engineer;
    if (['i', 'infi', 'infil', 'infiltrator', 'recon'].includes(value)) role = OpsRole.Infiltrator;

    if (['lightning'].includes(value)) role = OpsRole.Lightning;

    if (['f', 'fill'].includes(value)) role = OpsRole.Fill;

    return role;
  };

  const generateEmbed = async(signup: SignupChannel): Promise<MessageEmbed> => {
    const embed = new MessageEmbed().setTitle(signup.title);
    if (signup.description.length) embed.setDescription(signup.description);

    embed.addField('Date', signup.date, true);
    embed.addField('Time', signup.time, true);

    const roleTemplatesByType = groupBy(signup.templates, template => template);
    each(roleTemplatesByType, roleTemplatesOfType => {
      const signupRoleTemplateName = roleTemplatesOfType[0];
      const signupRoleTemplateDescription = roleTemplates[roleTemplatesOfType[0]].description;
      embed.addField('\u200b', signupRoleTemplateDescription);

      const signupRoleTemplate = roleTemplates[signupRoleTemplateName].roleTemplate;
      each(signupRoleTemplate, (singleTemplateRoleCount, templateRole) => {
        const templateRoleCount = +singleTemplateRoleCount * roleTemplatesOfType.length;
        const roleSignups = map(omitBy(signup.signups, role => role !== templateRole), (role, userid) => `<@${userid}>`);
        const roleSignupsString = `[${roleSignups.length}/${templateRoleCount}] ${roleSignups.join(', ')}`;
        if (templateRoleCount > 0) embed.addField(templateRole, roleSignupsString);
      });
    });

    embed.addField('\u200b', '\u200b', false);
    const altSignups = omitBy(signup.altSignups, role => !role.length);
    const altSignupsString = map(altSignups, (roles, userid) => `<@${userid}>: ${roles.join(', ')}`).join(`\n`);
    const hasAltSignups = keys(altSignups).length > 0;
    embed.addField(`Alternative roles`, hasAltSignups ? altSignupsString : 'n/a');

    embed.setFooter(signup.templates.join(', '));

    return embed;
  };

  trackExistingChannels();
  trackChannelCreation();
  trackSignupMessages();
  return Promise.resolve();
};
