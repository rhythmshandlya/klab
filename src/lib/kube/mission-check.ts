import type { DoCheck } from "@/lib/domain/mission-types";
import { isPodReady, readyEndpointCount, deploymentReadyReplicas } from "./kubectl/format";
import type { ClusterSnapshot } from "./simulator";

const ns = (o: { metadata?: { namespace?: string } }) => o.metadata?.namespace ?? "default";
const matches = (labels: Record<string, string> | undefined, sel: Record<string, string>) =>
  !!labels && Object.entries(sel).every(([k, v]) => labels[k] === v);

export function evaluateDoCheck(
  snapshot: ClusterSnapshot,
  check: DoCheck,
  namespace = "default",
): { passed: boolean; detail: string } {
  switch (check.kind) {
    case "pods-ready": {
      const ready = snapshot.pods.filter(
        (p) => ns(p) === namespace && matches(p.metadata?.labels, check.selector) && isPodReady(p),
      ).length;
      return { passed: ready >= check.minReady, detail: `${ready}/${check.minReady} matching pods ready` };
    }
    case "deployment-available": {
      const dep = snapshot.deployments.find((d) => ns(d) === namespace && d.metadata?.name === check.name);
      const avail = dep ? deploymentReadyReplicas(dep) : 0;
      return { passed: avail >= check.minAvailable, detail: `${avail}/${check.minAvailable} available` };
    }
    case "service-has-endpoints": {
      const svc = snapshot.services.find((s) => ns(s) === namespace && s.metadata?.name === check.name);
      const eps = svc ? readyEndpointCount(svc, snapshot.endpointSlices) : 0;
      return { passed: eps >= check.minEndpoints, detail: `${eps}/${check.minEndpoints} ready endpoints` };
    }
  }
}
