import { program } from 'commander';
import { registerCommands } from './commands';
import { version } from '../package.json';

const main = (argv: string[]) => {
  program.name('codemods-cli').version(version);

  registerCommands(program);

  program.parse(argv);
};

main(process.argv);
