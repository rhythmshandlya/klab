import type { ImageConstructor } from "@ngrok/webernetes";

import { ApiImage } from "./api";
import { DebugToolsImage } from "./debug-tools";
import { SlowApiImage } from "./slow-api";
import { WebAppImage } from "./web-app";
import { WebAppLegacyImage } from "./web-app-legacy";
import { WebAppV2Image } from "./web-app-v2";
import { WorkerImage } from "./worker";

/**
 * All klab fake images. Imported ONLY by the simulator (client-side) because these
 * modules pull in the Webernetes runtime. Content files refer to images by string
 * ref (e.g. "klab/web-app:1.0.0"), never by importing these classes.
 */
export const KLAB_IMAGES: readonly ImageConstructor[] = [
  WebAppImage,
  WebAppV2Image,
  WebAppLegacyImage,
  ApiImage,
  WorkerImage,
  DebugToolsImage,
  SlowApiImage,
];

/** ref -> human description, for docs/level "registered images" panels. */
export const KLAB_IMAGE_CATALOG: ReadonlyArray<{ ref: string; description: string }> = [
  { ref: "klab/web-app:1.0.0", description: "Web server: /healthz 200, /readyz 404, / 200." },
  { ref: "klab/web-app:2.0.0", description: "Broken release: starts, but serves 500 everywhere." },
  { ref: "klab/web-app:0.9.0", description: "Legacy build: /healthz 200 but / answers 500." },
  { ref: "klab/api:1.0.0", description: "API that calls another service by DNS name." },
  { ref: "klab/worker:1.0.0", description: "Queue worker; exits unless DATABASE_URL is set." },
  { ref: "klab/debug-tools:1.0.0", description: "Toolbox pod with a simulated curl." },
  {
    ref: "klab/slow-api:1.0.0",
    description: "API that warms up for five seconds before serving /healthz and /.",
  },
];

export {
  ApiImage,
  DebugToolsImage,
  SlowApiImage,
  WebAppImage,
  WebAppLegacyImage,
  WebAppV2Image,
  WorkerImage,
};
