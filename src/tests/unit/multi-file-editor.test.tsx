import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/editor/yaml-editor", () => ({
  YamlEditor: ({ path }: { path: string }) => <div data-testid="yaml-editor">{path}</div>,
}));

import { MultiFileEditor } from "@/features/playground/components/multi-file-editor";
import { usePlaygroundStore } from "@/features/playground/playground-store";

describe("MultiFileEditor", () => {
  beforeEach(() => {
    usePlaygroundStore.getState().loadFiles(
      {
        "deployment.yaml": "kind: Deployment\n",
        "service.yaml": "kind: Service\n",
        "resource-4.yaml": "kind: Pod\n",
      },
      "deployment.yaml",
    );
  });

  it("keeps Add file pinned outside the horizontal tab scroller", () => {
    render(<MultiFileEditor />);

    const tabs = screen.getByRole("tablist", { name: "Manifest files" });
    const addFile = screen.getByRole("button", { name: "Add file" });

    expect(tabs).not.toContainElement(addFile);
    expect(tabs).toHaveClass("overflow-x-auto", "overflow-y-hidden");
  });

  it("adds a unique file when the length-based name already exists", () => {
    render(<MultiFileEditor />);
    fireEvent.click(screen.getByRole("button", { name: "Add file" }));

    expect(screen.getByRole("tab", { name: "resource-5.yaml" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("yaml-editor")).toHaveTextContent("resource-5.yaml");
  });

  it("renames a file inline and preserves its contents", () => {
    render(<MultiFileEditor />);

    fireEvent.doubleClick(screen.getByRole("tab", { name: "deployment.yaml" }));
    const input = screen.getByRole("textbox", { name: "New name for deployment.yaml" });
    fireEvent.change(input, { target: { value: "web-deployment.yaml" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("tab", { name: "web-deployment.yaml" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByTestId("yaml-editor")).toHaveTextContent("web-deployment.yaml");
    expect(usePlaygroundStore.getState().files["web-deployment.yaml"]).toBe("kind: Deployment\n");
    expect(usePlaygroundStore.getState().files["deployment.yaml"]).toBeUndefined();
  });

  it("keeps rename open when the requested name already exists", () => {
    render(<MultiFileEditor />);

    fireEvent.doubleClick(screen.getByRole("tab", { name: "deployment.yaml" }));
    const input = screen.getByRole("textbox", { name: "New name for deployment.yaml" });
    fireEvent.change(input, { target: { value: "service.yaml" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByRole("alert")).toHaveTextContent("already exists");
    expect(input).toHaveValue("service.yaml");
    expect(usePlaygroundStore.getState().files["deployment.yaml"]).toBe("kind: Deployment\n");
  });

  it("supports F2 as the keyboard equivalent for renaming", () => {
    render(<MultiFileEditor />);

    fireEvent.keyDown(screen.getByRole("tab", { name: "deployment.yaml" }), { key: "F2" });

    expect(
      screen.getByRole("textbox", { name: "New name for deployment.yaml" }),
    ).toBeInTheDocument();
  });
});
