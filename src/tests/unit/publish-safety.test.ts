import { describe, expect, it } from "vitest";

import { checkPlaygroundPublishSafety } from "@/lib/playgrounds/publish-safety";

describe("Playground publish safety", () => {
  it("allows ordinary manifests and explicit placeholders", () => {
    expect(
      checkPlaygroundPublishSafety({
        "deployment.yaml":
          "apiVersion: apps/v1\nkind: Deployment\nspec:\n  template:\n    spec:\n      containers:\n        - name: app\n          env:\n            - name: API_TOKEN\n              value: ${API_TOKEN}\n",
      }),
    ).toEqual([]);
  });

  it("blocks Kubernetes Secrets and sensitive literal environment values", () => {
    const issues = checkPlaygroundPublishSafety({
      "secret.yaml": "apiVersion: v1\nkind: Secret\nstringData:\n  password: hunter2\n",
      "pod.yaml":
        "apiVersion: v1\nkind: Pod\nspec:\n  containers:\n    - name: app\n      env:\n        - name: API_TOKEN\n          value: live-value\n",
    });
    expect(issues).toHaveLength(2);
    expect(issues.map((issue) => issue.path)).toEqual(["secret.yaml", "pod.yaml"]);
  });

  it("blocks credential filenames and malformed YAML that cannot be inspected", () => {
    const issues = checkPlaygroundPublishSafety({
      ".env.production": "TOKEN=real",
      "broken.yaml": "metadata: [",
    });
    expect(issues).toHaveLength(2);
    expect(issues[0]?.message).toContain("filename");
    expect(issues[1]?.message).toContain("YAML syntax");
  });
});
