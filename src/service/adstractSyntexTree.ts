import * as generate from "@babel/generator";
import * as babelParser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { parse as parseHTML, HTMLElement } from "node-html-parser";

// Supported file types
export enum FileType {
  JS = "js",
  JSX = "jsx",
  TS = "ts",
  TSX = "tsx",
  HTML = "html",
  CSS = "css",
  MD = "md",
}

export interface FileContextResult {
  snippet: string;
  imports: string[];
  exports: string[];
  dependencies: string[];
  lines: number;
  fileType: string;
}

/**
 * Get Babel parser plugins based on file type
 */
function getParserPlugins(fileType: FileType): babelParser.ParserPlugin[] {
  switch (fileType) {
    case FileType.TS: return ["typescript"];
    case FileType.TSX: return ["typescript", "jsx"];
    case FileType.JSX: return ["jsx"];
    default: return [];
  }
}

/**
 * Determine file type from filename
 */
function getFileType(fileName: string): FileType {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "js": return FileType.JS;
    case "jsx": return FileType.JSX;
    case "ts": return FileType.TS;
    case "tsx": return FileType.TSX;
    case "html": return FileType.HTML;
    case "css": return FileType.CSS;
    case "md": return FileType.MD;
    default: return FileType.JS;
  }
}

/**
 * Extract file context using AST for code or minimal parsing for HTML/MD/CSS
 */
// #region --------- AST -----------
export function extractFileContextAST(
  fileName: string,
  fileContent: string,
  targetIdentifier?: string
): FileContextResult {
  
  if (fileName.endsWith(".json")) {
    return {
      snippet: fileContent,
      imports: [],
      exports: [],
      dependencies: [],
      lines: fileContent.split("\n").length,
      fileType: "json",
    };
  }
  const fileType = getFileType(fileName);

  let snippet = fileContent;
  let imports: string[] = [];
  let exports: string[] = [];
  let dependencies: string[] = [];

  // AST parsing for JS/TS/JSX/TSX
  if ([FileType.JS, FileType.JSX, FileType.TS, FileType.TSX].includes(fileType)) {
    const plugins = getParserPlugins(fileType);
    const ast = babelParser.parse(fileContent, { sourceType: "module", plugins });

    traverse.default(ast, {
      ImportDeclaration(path: any) {
        const imp = path.node.source.value;
        imports.push(imp);
        dependencies.push(imp);
      },
      ExportNamedDeclaration(path: any) {
        const decl: any = path.node.declaration;
        if (!decl) return;
        if (decl.id && decl.id.name) exports.push(decl.id.name);
        else if (decl.declarations && Array.isArray(decl.declarations)) {
          decl.declarations.forEach((d: any) => {
            if (d.id && d.id.name) exports.push(d.id.name);
          });
        }
      },
      ExportDefaultDeclaration(path: any) {
        const decl: any = path.node.declaration;
        if (decl?.id?.name) exports.push(decl.id.name);
        else exports.push("default");
      }
    });

    // Extract snippet for target function/component
    if (targetIdentifier) {
      traverse.default(ast, {
        enter(path: any) {
          const nodeName: string | undefined = path.node?.id?.name || path.node?.key?.name;
          if (nodeName === targetIdentifier) {
            snippet = generate.generate(path.node).code;
            path.stop();
          }
        }
      });
    }
  }

  else if ([FileType.HTML, FileType.CSS, FileType.MD].includes(fileType)) {
    if (fileType === FileType.HTML) {
      const root = parseHTML(fileContent);
      if (targetIdentifier) {
        const el: HTMLElement | null = root.querySelector(targetIdentifier);
        snippet = el ? el.toString() : fileContent;
      }
    }
  }

  const lines = snippet.split("\n").length;

  return { snippet, imports, exports, dependencies, lines, fileType };
}
