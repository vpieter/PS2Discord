import { Commands } from '../commands';
import { HelpCommandHandler } from './help';
import { OnlineCommandHandler } from './online';
import { BasesCommandHandler } from './bases';
import { MembersCommandHandler } from './members';
import { OpCommandHandler } from './op';
import { TrainingCommandHandler } from './training';

export const CommandHandlers = {
  [Commands.Help]: HelpCommandHandler,
  [Commands.Members]: MembersCommandHandler,
  [Commands.Online]: OnlineCommandHandler,
  [Commands.Bases]: BasesCommandHandler,
  [Commands.Op]: OpCommandHandler,
  [Commands.Training]: TrainingCommandHandler,
};
