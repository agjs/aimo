/**
 * @file ping.command.ts
 * @layer app
 * @description Registers `aimo ping` — one round-trip through the in-process fake chat port (for CI smoke).
 */

import { EXIT_SUCCESS } from '@core/contracts/ExitCodes.constants';
import { InProcessFakeChatProvider } from '@providers/fake/InProcessFakeChat.provider';
import type { Command } from 'commander';

/**
 * Registers `ping` on the root commander program.
 * @param program - Root `commander` program (`aimo`).
 */
export function registerPingCommand(program: Command): void {
  program
    .command('ping')
    .description('run one fake chat completion (for wiring smoke / CI)')
    .option('--json', 'print machine-readable JSON on stdout')
    .action(async (options: { json?: boolean }) => {
      const fake = new InProcessFakeChatProvider();
      const reply = await fake.complete({
        model: 'stub',
        messages: [{ role: 'user', content: 'ping' }],
      });
      const text = reply.choices[0]?.message.content ?? '';

      if (options.json) {
        process.stdout.write(`${JSON.stringify({ ok: true, reply: text, id: reply.id })}\n`);
      } else {
        process.stdout.write(`${text}\n`);
      }

      process.exit(EXIT_SUCCESS);
    });
}
