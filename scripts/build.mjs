import process from "node:process";

import { runNext } from "./run-next.mjs";

runNext("build", process.argv.slice(2));
