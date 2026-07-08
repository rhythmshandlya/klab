import type { ImageConstructor } from "@ngrok/webernetes";

import { ApiImage } from "./api";
import { DebugToolsImage } from "./debug-tools";
import { WebAppImage } from "./web-app";

/**
 * All klab fake images. Imported ONLY by the simulator (client-side) because these
 * modules pull in the Webernetes runtime. Content files refer to images by string
 * ref (e.g. "klab/web-app:1.0.0"), never by importing these classes.
 */
export const KLAB_IMAGES: readonly ImageConstructor[] = [WebAppImage, ApiImage, DebugToolsImage];

/** ref -> human description, for docs/level "registered images" panels. */
export const KLAB_IMAGE_CATALOG: ReadonlyArray<{ ref: string; description: string }> = [
  { ref: "klab/web-app:1.0.0", description: "Web server: /healthz 200, /readyz 404, / 200." },
  { ref: "klab/api:1.0.0", description: "API that calls another service by DNS name." },
  { ref: "klab/debug-tools:1.0.0", description: "Toolbox pod with a simulated curl." },
];

export { ApiImage, DebugToolsImage, WebAppImage };
