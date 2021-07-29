import { DiscordCommands } from '../commands';
import { BasesCommand } from './bases';
import { MembersCommand } from './members';
import { OnlineCommand } from './online';
import { OpCommand } from './op';
import { OpReportCommand } from './opreport';
import { TrainingCommand } from './training';

export const DiscordCommandHandlers = {
  [DiscordCommands.Members]: MembersCommand,
  [DiscordCommands.Online]: OnlineCommand,
  [DiscordCommands.Bases]: BasesCommand,
  [DiscordCommands.Training]: TrainingCommand,
  [DiscordCommands.Op]: OpCommand,
  [DiscordCommands.OpReport]: OpReportCommand,
};
