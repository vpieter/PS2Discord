import { Command } from '../types';
import { ps2ControlledBases, ps2MainOutfit } from '../../../app';

export async function BasesCommandHandler (command: Command): Promise<void> {
  if (!command.discordMessage) throw('Unexpected BasesCommandHandler command.discordMessage null');

  const basesText = ps2ControlledBases.length ?
    ps2ControlledBases.map(facility => `${facility.name} (${facility.zone.name} ${facility.type})`).join(',') :
    'no bases';
  const messageText = `${ps2MainOutfit.alias} currently controls: ${basesText}`;

  await command.discordMessage.channel.send(messageText);
  return Promise.resolve();
};
