import process from "node:process";

import { runNext } from "./run-next.mjs";

runNext("start", process.argv.slice(2));
