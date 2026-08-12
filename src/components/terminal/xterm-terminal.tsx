"use client";

import "@xterm/xterm/css/xterm.css";

import { useEffect, useRef } from "react";

import { palette } from "@/lib/design/tokens";

export interface TerminalRunResult {
  output: string;
  isError: boolean;
  clear?: boolean;
}

export interface XtermTerminalProps {
  /** Executes a submitted command line and resolves with text to print. */
  onCommand: (line: string) => Promise<TerminalRunResult>;
  /**
   * Receives a runner that types + submits a command programmatically (quick-command
   * chips). Called with the runner once the terminal is live, and with null on
   * teardown.
   */
  registerRunner?: (run: ((line: string) => void) | null) => void;
  welcome?: string[];
  prompt?: string;
}

const RED = "\x1b[31m";
const DIM = "\x1b[90m";
const RESET = "\x1b[0m";

const KEY_ENTER = "\r";
const KEY_BACKSPACE = "\x7f";
const KEY_CTRL_C = "\x03";
const KEY_CTRL_L = "\x0c";
const KEY_UP = "\x1b[A";
const KEY_DOWN = "\x1b[B";

/**
 * xterm.js terminal with a minimal line editor: command history (↑/↓), backspace,
 * Ctrl+L clear, Ctrl+C cancel, and paste. Commands are executed via `onCommand`;
 * output is printed and the prompt redrawn. The xterm library loads lazily (browser
 * only). Kept out of React render: the effect owns the imperative terminal.
 */
export function XtermTerminal({
  onCommand,
  registerRunner,
  welcome,
  prompt = "$ ",
}: XtermTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCommandRef = useRef(onCommand);
  const registerRunnerRef = useRef(registerRunner);
  const welcomeRef = useRef(welcome);

  // Keep the latest callbacks in refs without mutating during render.
  useEffect(() => {
    onCommandRef.current = onCommand;
    registerRunnerRef.current = registerRunner;
    welcomeRef.current = welcome;
  });

  useEffect(() => {
    let disposed = false;
    let dispose = () => {};

    void (async () => {
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import("@xterm/xterm"),
        import("@xterm/addon-fit"),
      ]);
      if (disposed || !containerRef.current) return;

      const term = new Terminal({
        convertEol: true,
        cursorBlink: true,
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 13,
        lineHeight: 1.3,
        theme: {
          background: palette.terminalBackground,
          foreground: palette.text,
          cursor: palette.blue,
          selectionBackground: "#1d4ed855",
          brightBlack: palette.textSubtle,
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);
      term.open(containerRef.current);
      try {
        fit.fit();
      } catch {
        /* container not measurable yet */
      }

      const history: string[] = [];
      let historyIndex = -1;
      let line = "";
      let running = false;

      const writePrompt = () => term.write(prompt);
      for (const l of welcomeRef.current ?? []) term.writeln(`${DIM}${l}${RESET}`);
      writePrompt();

      const printResult = (result: TerminalRunResult) => {
        if (result.clear) {
          term.clear();
          return;
        }
        if (result.output) {
          const body = result.isError ? `${RED}${result.output}${RESET}` : result.output;
          term.write(`\r\n${body}`);
        }
      };

      const submit = async () => {
        const command = line;
        line = "";
        term.write("\r\n");
        if (command.trim() === "") {
          writePrompt();
          return;
        }
        history.push(command);
        historyIndex = history.length;
        running = true;
        try {
          const result = await onCommandRef.current(command);
          printResult(result);
        } catch (error) {
          term.write(`\r\n${RED}error: ${(error as Error).message}${RESET}`);
        } finally {
          running = false;
          term.write("\r\n");
          writePrompt();
        }
      };

      const replaceLine = (next: string) => {
        term.write("\r\x1b[K");
        writePrompt();
        term.write(next);
        line = next;
      };

      term.onData((data) => {
        if (running) return;
        switch (data) {
          case KEY_ENTER:
            void submit();
            return;
          case KEY_BACKSPACE:
            if (line.length > 0) {
              line = line.slice(0, -1);
              term.write("\b \b");
            }
            return;
          case KEY_CTRL_C:
            term.write("^C\r\n");
            line = "";
            writePrompt();
            return;
          case KEY_CTRL_L:
            term.clear();
            line = "";
            return;
          case KEY_UP:
            if (history.length > 0 && historyIndex > 0) {
              historyIndex -= 1;
              replaceLine(history[historyIndex] ?? "");
            }
            return;
          case KEY_DOWN:
            if (historyIndex < history.length - 1) {
              historyIndex += 1;
              replaceLine(history[historyIndex] ?? "");
            } else {
              historyIndex = history.length;
              replaceLine("");
            }
            return;
          default: {
            // Printable input (single chars or pasted text). Strip control chars.

            const clean = data.replace(/[\x00-\x1f\x7f]/g, "");
            if (clean) {
              line += clean;
              term.write(clean);
            }
          }
        }
      });

      const resize = new ResizeObserver(() => {
        try {
          fit.fit();
        } catch {
          /* ignore */
        }
      });
      resize.observe(containerRef.current);

      // Programmatic runner for quick-command chips: type the line, then submit it
      // through the exact same path as keyboard input (history, evidence, output).
      registerRunnerRef.current?.((commandLine: string) => {
        if (running) return;
        replaceLine(commandLine);
        void submit();
      });

      dispose = () => {
        registerRunnerRef.current?.(null);
        resize.disconnect();
        term.dispose();
      };
    })();

    return () => {
      disposed = true;
      dispose();
    };
    // Create once; latest callbacks are read from refs.
  }, [prompt]);

  return <div ref={containerRef} className="h-full w-full overflow-hidden px-2 py-1.5" />;
}
