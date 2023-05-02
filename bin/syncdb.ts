import { initOrm } from "../src/db/orm";
import { logger } from "../src/lib/logger";
import readline from "readline";

const rl = readline.createInterface(process.stdin, process.stdout);
async function ask(question: string) {
  return new Promise<string>((resolve) => {
    rl.question(question, (answer) => resolve(answer));
  });
}
resync();

async function resync() {
  const answer = await ask('Do you want to resync the Betterlox production database? y/n ');
  if (answer.toLowerCase() !== "y") {
    process.exit();
  }

  logger.info('Beginning resync...');
  try {
    await initOrm({ resyncDb: true });
  } catch (error: any) {
    logger.error(`An error occurred while resyncing: ${error.message}`);
    process.exit(255);
  }

  logger.info('Finished resync successfully');
  process.exit(0);
}