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
  snippets: { symbolName: string, snippet: string, functionType: string }[];
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
      snippets: [{ symbolName: fileName, snippet: fileContent, functionType: "none" }],
      imports: [],
      exports: [],
      dependencies: [],
      lines: fileContent.split("\n").length,
      fileType: "json",
    };
  }
  const fileType = getFileType(fileName);

  let snippets: { symbolName: string, snippet: string, functionType: string }[] = [];
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

    // Extract snippetss for target function/component
    traverse.default(ast, {

      FunctionDeclaration(path: any) {
        const name = path.node.id?.name;

        if (!name) return;

        const code = generate.generate(path.node).code;
        const isReactComponent = name[0] === name[0].toUpperCase();

        snippets.push({
          symbolName: name,
          snippet: code,
          functionType: isReactComponent
            ? "React functional component"
            : "Function"
        });
      },

      VariableDeclarator(path: any) {
        const name = path.node.id?.name;
        const init = path.node.init;

        if (
          name &&
          (init?.type === "ArrowFunctionExpression" ||
            init?.type === "FunctionExpression")
        ) {
          const code = generate.generate(path.parentPath.node).code;

          const isReactComponent = name[0] === name[0].toUpperCase();

snippets.push({
  symbolName: name,
  snippet: code,
  functionType: isReactComponent
    ? "React arrow functional component"
    : "Arrow function"
});
        }
      },

      ClassMethod(path: any) {
        const name = path.node.key?.name;

        if (!name) return;

        const code = generate.generate(path.node).code;

snippets.push({
  symbolName: name,
  snippet: code,
  functionType: "Class method"
});

      },

      ObjectMethod(path: any) {
        const name = path.node.key?.name;

        if (!name) return;

        const code = generate.generate(path.node).code;

        snippets.push({ symbolName: name, snippet: code, functionType: "Object method" });
      }

    });
  }

  else if ([FileType.HTML, FileType.CSS, FileType.MD].includes(fileType)) {
    if (fileType === FileType.HTML) {
      const root = parseHTML(fileContent);
      if (targetIdentifier) {
        const el: HTMLElement | null = root.querySelector(targetIdentifier);
        snippets = el ? [{ symbolName: fileName, snippet: el.toString(), functionType: "none" }] : [{ symbolName: fileName, snippet: fileContent, functionType: "none" }];
      }
    }
  }

  const lines = snippets.reduce((total, snip) => { return total + snip.snippet.length }, 0);

  return { snippets, imports, exports, dependencies, lines, fileType };
}

