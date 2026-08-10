import fs from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

const PROJECT_ROOT = process.cwd();
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src");
const DOCS_FEATURE_ROOT = path.join(SOURCE_ROOT, "features", "docs");
const SCRIPT_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx"] as const;
const SOURCE_FILE_CACHE = new Map<string, ts.SourceFile>();
const IMPORT_EDGE_CACHE = new Map<string, readonly ImportEdge[]>();

interface ImportEdge {
  importer: string;
  specifier: string;
  imported: string;
}

function sourceFilesUnder(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return sourceFilesUnder(entryPath);
      return SCRIPT_EXTENSIONS.includes(
        path.extname(entry.name) as (typeof SCRIPT_EXTENSIONS)[number],
      )
        ? [entryPath]
        : [];
    })
    .sort();
}

function parseSource(filePath: string): ts.SourceFile {
  const cached = SOURCE_FILE_CACHE.get(filePath);
  if (cached) return cached;

  const source = ts.createSourceFile(
    filePath,
    fs.readFileSync(filePath, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath),
  );
  SOURCE_FILE_CACHE.set(filePath, source);
  return source;
}

function scriptKind(filePath: string): ts.ScriptKind {
  switch (path.extname(filePath)) {
    case ".tsx":
      return ts.ScriptKind.TSX;
    case ".jsx":
      return ts.ScriptKind.JSX;
    case ".js":
      return ts.ScriptKind.JS;
    default:
      return ts.ScriptKind.TS;
  }
}

function isClientModule(filePath: string): boolean {
  const source = parseSource(filePath);
  return source.statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === "use client",
  );
}

function hasRuntimeImport(importDeclaration: ts.ImportDeclaration): boolean {
  const clause = importDeclaration.importClause;
  if (!clause) return true;
  if (clause.isTypeOnly) return false;
  if (clause.name) return true;
  if (!clause.namedBindings) return false;
  if (ts.isNamespaceImport(clause.namedBindings)) return true;
  return clause.namedBindings.elements.some((element) => !element.isTypeOnly);
}

function hasRuntimeExport(exportDeclaration: ts.ExportDeclaration): boolean {
  if (exportDeclaration.isTypeOnly) return false;
  if (!exportDeclaration.exportClause) return true;
  if (ts.isNamespaceExport(exportDeclaration.exportClause)) return true;
  return exportDeclaration.exportClause.elements.some((element) => !element.isTypeOnly);
}

function staticValueSpecifiers(filePath: string): string[] {
  const source = parseSource(filePath);
  const specifiers: string[] = [];

  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      hasRuntimeImport(statement)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
      continue;
    }

    if (
      ts.isExportDeclaration(statement) &&
      statement.moduleSpecifier &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      hasRuntimeExport(statement)
    ) {
      specifiers.push(statement.moduleSpecifier.text);
      continue;
    }

    if (
      ts.isImportEqualsDeclaration(statement) &&
      !statement.isTypeOnly &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      statement.moduleReference.expression &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      specifiers.push(statement.moduleReference.expression.text);
    }
  }

  const visitDynamicImports = (node: ts.Node): void => {
    const [specifier] = ts.isCallExpression(node) ? node.arguments : [];
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      specifier &&
      ts.isStringLiteralLike(specifier)
    ) {
      specifiers.push(specifier.text);
    }
    ts.forEachChild(node, visitDynamicImports);
  };
  visitDynamicImports(source);

  return specifiers;
}

function resolveScript(basePath: string): string | undefined {
  const candidates = [
    basePath,
    ...SCRIPT_EXTENSIONS.map((extension) => `${basePath}${extension}`),
    ...SCRIPT_EXTENSIONS.map((extension) => path.join(basePath, `index${extension}`)),
  ];

  return candidates.find((candidate) => {
    if (
      !SCRIPT_EXTENSIONS.includes(path.extname(candidate) as (typeof SCRIPT_EXTENSIONS)[number])
    ) {
      return false;
    }
    return fs.existsSync(candidate) && fs.statSync(candidate).isFile();
  });
}

function resolveLocalImport(importer: string, specifier: string): string | undefined {
  if (specifier.startsWith("@/")) {
    return resolveScript(path.join(SOURCE_ROOT, specifier.slice(2)));
  }
  if (specifier.startsWith(".")) {
    return resolveScript(path.resolve(path.dirname(importer), specifier));
  }
  return undefined;
}

function projectPath(filePath: string): string {
  return path.relative(PROJECT_ROOT, filePath).replaceAll(path.sep, "/");
}

function isHeavyCurriculumImplementation(filePath: string): boolean {
  const relativePath = projectPath(filePath);
  return (
    relativePath.startsWith("src/content/docs/") ||
    relativePath.startsWith("src/content/missions/") ||
    relativePath.startsWith("src/content/levels/") ||
    relativePath.startsWith("src/content/playground-templates/") ||
    relativePath === "src/content/curriculum/server.ts"
  );
}

function importEdges(filePath: string): ImportEdge[] {
  const cached = IMPORT_EDGE_CACHE.get(filePath);
  if (cached) return [...cached];

  const edges = staticValueSpecifiers(filePath).flatMap((specifier) => {
    const imported = resolveLocalImport(filePath, specifier);
    return imported ? [{ importer: filePath, specifier, imported }] : [];
  });
  IMPORT_EDGE_CACHE.set(filePath, edges);
  return edges;
}

function findHeavyImportChains(clientRoot: string): ImportEdge[][] {
  const violations: ImportEdge[][] = [];
  const visited = new Set<string>();

  const visit = (filePath: string, chain: ImportEdge[]): void => {
    if (visited.has(filePath)) return;
    visited.add(filePath);

    for (const edge of importEdges(filePath)) {
      const nextChain = [...chain, edge];
      if (isHeavyCurriculumImplementation(edge.imported)) {
        violations.push(nextChain);
      } else {
        visit(edge.imported, nextChain);
      }
    }
  };

  visit(clientRoot, []);
  return violations;
}

function formatChain(chain: readonly ImportEdge[]): string {
  const [first] = chain;
  if (!first) return "";

  return [
    `  ${projectPath(first.importer)}`,
    ...chain.map(
      (edge) => `    -> ${JSON.stringify(edge.specifier)} (${projectPath(edge.imported)})`,
    ),
  ].join("\n");
}

describe("Docs client Curriculum seam", () => {
  it("keeps authored Curriculum implementations out of the client import graph", () => {
    const clientRoots = sourceFilesUnder(DOCS_FEATURE_ROOT).filter(isClientModule);
    expect(clientRoots.length).toBeGreaterThan(0);

    const violations = clientRoots.flatMap(findHeavyImportChains);
    if (violations.length > 0) {
      throw new Error(
        [
          "Authored Curriculum implementation modules entered the Docs client graph:",
          ...violations.map(formatChain),
          "Client modules may import types from src/content/curriculum/model.ts, but authored bodies must stay behind src/content/curriculum/server.ts.",
        ].join("\n\n"),
      );
    }
  });
});
