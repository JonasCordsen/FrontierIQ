import { executeCurrentStateViewCommand } from "./current-state-view-contract.mjs";

const result = executeCurrentStateViewCommand(process.argv.slice(2));
process.stdout.write(`${result.stdout}\n`);
process.exitCode = result.exitCode;

