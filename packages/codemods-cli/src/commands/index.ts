import { Command } from 'commander';

export function registerCommands(program: Command) {
  program
    .command('run')
    .description('Runs a codemod locally.')
    .requiredOption(
      '--codemod-manifest <FILE>',
      'Path to a manifest describing codemod file to run.',
    )
    .requiredOption(
      '--entity-manifest <FILE>',
      'Path to a manifest describing catalog entity to apply the codemod on.',
    )
    .requiredOption(
      '--parameters <JSON>',
      'JSON blob describing the parameters to hand over to the codemod.',
      JSON.parse,
    )
    .option('-v --verbose', 'Enable verbose output.', false)
    .action(lazy(() => import('./run/run').then(m => m.default)));
}

// Wraps an action function so that it always exits and handles errors
// Humbly taken from backstage-cli's registerCommands
function lazy(
  getActionFunc: () => Promise<(...args: any[]) => Promise<void>>,
): (...args: any[]) => Promise<never> {
  return async (...args: any[]) => {
    try {
      const actionFunc = await getActionFunc();
      await actionFunc(...args);
      process.exit(0);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error.message);
      process.exit(1);
    }
  };
}
