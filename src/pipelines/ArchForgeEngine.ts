// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

//? ArchForge Engin
// #region ---------- ArchForge ---------
import mongoose, { Types } from "mongoose";
import getVectorEmbedding from "../service/vectorTransformer.js";
import { FileVector } from "../model/file_vectors.js";
import { IProjectFile, ProjectFile } from "../model/project_files.js";
import { buildAsciiTree } from "../service/treeNodeBuilder.js";
import { AI_MODULE, Google_GenAI } from "../config/groqSdkConfig.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions.mjs";
import { ArchEnginStatusSocket } from "../sockets/ArchEnginProcess.js";
import { processIdProvider, uIdProvider } from "../service/user.uidProvider.js";
import { archSSEmanager } from "../serversideevents/ArchSSEManager.js";
import { codeGenPrompt } from "./ArchPrompts.js";
import { Snapshot, snapshotEnum } from "../model/snapshot.js";
import { snapShotFile } from "../model/snapshotfile.js";

interface Process {
  prompt: string;
  userId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  cursor_fileId: mongoose.Types.ObjectId;
  jobId: string;
}

interface ArchFileContext {
  _id: mongoose.Types.ObjectId;
  context: {
    fileId: mongoose.Types.ObjectId;
    snippet: string;
    filePath: string;
    imports: string[];
    exports: string[];
    fileType: string;
    isDefault: boolean;
  };
}
export type FileAction = "create" | "modify" | "retain";

type ProjectPlan = Record<
  string,
  {
    action: "create" | "modify";
    role: "app-entry" | "page" | "layout" | "component" | "state" | "utility";
    responsibilities: string[];
    constraints?: string[];
    inputs?: string[];
    outputs?: string[];
    executionOrder: number;
  }
>;

export interface ArchProjectCode {
  path: string;
  content: string;
  dependency?: string;
}

interface snaps {
  path: string;
  content: string | null;
  action: string;
}

interface GenerationRequest {
  task: "create" | "modify";
  targetFile: string;
  architecturalResponsibilities: string[];
  constraints: string[];
  existingFileContent: string | null;
}
export default class ArchForge {
  public static async _process_(processArgs: Process) {
    //! assume there is text only (Version 1)

    await this.lexicalArchPipeLine(processArgs);
  }

  // #region ------- Laxical ArchPipeLine --------
  private static async lexicalArchPipeLine(processArgs: Process): Promise<any> {
    try {
      const { prompt, projectId, userId, cursor_fileId, jobId } = processArgs;

      const processId = processIdProvider();
      this.pushToUser(
        "Analyzing your request and scanning related project files...",
        projectId,
        userId,
        processId,
        "render"
      );

      // -------------- RAG ---------------------------
      const queryVector = await getVectorEmbedding(prompt);

      const relatedFiles = await FileVector.aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "vector",
            queryVector,
            numCandidates: 380,
            limit: 12,
            filter: { projectId: new mongoose.Types.ObjectId(projectId) },
          },
        },
        { $project: { fileId: 1, contextId: 1, score: { $meta: "vectorSearchScore" } } },
        {
          $lookup: {
            from: "filecontexts",
            localField: "contextId",
            foreignField: "_id",
            as: "context",
          },
        },
        { $unwind: "$context" },
        { $match: { "context.isDefault": false } },
        {
          $project: {
            score: { $meta: "vectorSearchScore" },
            projectId: 1,
            context: {
              isDefault: 1,
              imports: 1,
              exports: 1,
              snippet: 1,
              fileId: 1,
              fileType: 1,
              filePath: 1,
            },
          },
        },
      ]);

      const context = [];

      relatedFiles.sort((cadidateA, candidateB) => candidateB.score - cadidateA.score);
      const seen = new Set<string>();

      for (const file of relatedFiles) {
        if (context.length === 6) break;
        const fileId = file._id.toString();
        if (!seen.has(fileId)) {
          seen.add(fileId);
          context.push(file);
        }
      }

      const codeBase = await this.projectTree(projectId, userId);

      this.pushToUser("-", projectId, userId, processId, "complete");

      const plannerScript = await this.archProjectPlanner(
        context,
        codeBase,
        prompt,
        projectId,
        userId
      );

      const snapids = await this.ArchCodeGenerator(
        context,
        plannerScript,
        projectId,
        userId,
        jobId
      );
      archSSEmanager.complete(jobId, snapids);
    } catch (error) {
      console.error("Error in lexicalArchEngin:", error);
      return null;
    }
  }
  // #endregion

  private static async projectTree(
    projectId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<string> {
    try {
      const projectFile = (await ProjectFile.find(
        { projectId, userId },
        { content: 0 }
      ).lean()) as unknown as IProjectFile[];

      const treeNode = buildAsciiTree(projectFile);
      return treeNode;
    } catch (error) {
      console.error("Error in ProjectTree ArchEngin:", error);
      return "";
    }
  }

  // #region ------ AI CodeFile Generation ------
  private static async ArchCodeGenerator(
    fileContexts: ArchFileContext[],
    planedScript: ProjectPlan,
    projectId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    jobId: string
  ): Promise<{ snapv1Id: string; snapv2Id: string } | null> {
    try {
      const planKeys = Object.entries(planedScript)
        .sort(([, a], [, b]) => a.executionOrder - b.executionOrder)
        .map(([path]) => path);

      const allowedImportsContext = fileContexts
        .map((fc) => `- ${fc.context.filePath}: exports [${fc.context.exports.join(", ")}]`)
        .join("\n");

      const plannedFilesContext = Object.entries(planedScript)
        .map(([path, info]) => `- ${path}: role=${info.role}`)
        .join("\n");

      const lagacyCode = new Map<string, string>();

      await Promise.all(
        planKeys.map(async (key) => {
          const action = planedScript[key].action;

          if (action === "create") return;

          const code = await this.fileCodeProvider(key, projectId);
          lagacyCode.set(key, code);
        })
      );

      const parentFiles: snaps[] = planKeys.map((key) => {
        const file = planedScript[key];
        return {
          action: file.action,
          content: lagacyCode.has(key) ? lagacyCode.get(key)! : null,
          path: key,
        };
      });

      const enrichedFiles: snaps[] = [];

      // ---------------------- Batch Process ---------------

      const batchSize = 2;
      const batches: string[][] = [];

      for (let i = 0; i < planKeys.length; i += batchSize) {
        batches.push(planKeys.slice(i, i + batchSize));
      }

      // Bricks MD
      let markdownPlanner = await this.BricksMdFileProvider(
        projectId,
        userId,
        planedScript,
        batches.length
      );

      const markdownCleanerRequest = {
        task: "modify",
        targetFile: "Bricks.md",
        architecturalResponsibilities: [
          "ROLE: You are the Finalization Agent. The current multi-batch project has successfully concluded.",
          "ACTION: Your sole responsibility is to perform a hard reset on this file to prepare the workspace for future, entirely unrelated tasks.",
          "STEP 1: Delete all existing content, including all metadata, completed files, and previous Batch Logs.",
          "STEP 2: Output ONLY a fresh, clean slate template exactly as follows:",
          "# Project State Journal (Bricks.md)\n\n**Status**: Ready for New Task\n**Last Updated**: " +
            new Date().toISOString() +
            "\n\n> **System Directive**: Awaiting new project plan.",
        ],
        constraints: [
          "HARD WIPE: Do not preserve any history, JSON blocks, or previous batch information. The old task is completely finished.",
          "NO APOLOGIES: Output strictly the new markdown text provided in STEP 2. Do not add introductory or concluding conversational text.",
          "NO HALLUCINATION: Do not invent a new plan or anticipate what the next task will be.",
        ],
        existingFileContent: null,
      } as GenerationRequest;

      const enrichedRequests = await Promise.all(
        batches.map(async (batch) => {
          const enrichedRequest = await Promise.all(
            batch.map(async (filePath) => {
              const info = planedScript[filePath];

              return {
                task: info.action,
                targetFile: filePath,
                architecturalResponsibilities: info.responsibilities,
                constraints: info.constraints ?? [],
                existingFileContent: lagacyCode.get(filePath) ?? null,
              };
            })
          );
          return enrichedRequest;
        })
      );

      for (let i = 0; i < enrichedRequests.length; i++) {
        const processMap = new Map<string, GenerationRequest>();

        for (const req of enrichedRequests[i]) {
          const tempProcessId = processIdProvider();
          processMap.set(tempProcessId, req);
          this.pushToUser(
            `${req.task === "create" ? "Creating" : "Modifying"}: ${req.targetFile} • ${req.architecturalResponsibilities}`,
            projectId,
            userId,
            tempProcessId,
            "render"
          );
        }

        const enrichedFilesWithMd = [...enrichedRequests[i], markdownPlanner];
        if (i === enrichedRequests.length - 1) enrichedFilesWithMd.push(markdownCleanerRequest);

        const systemPrompt = codeGenPrompt;

        const userMessage = `
          You are a Principal-Level Senior React + TypeScript Architect.

          ========================
          TOP PRIORITY: RELIABILITY OVER CREATIVITY
          ========================
          The person using this output CANNOT debug code. That means "it renders correctly on the very first try, with zero runtime errors" is the #1 success metric — above visual impressiveness, above cleverness, above anything else in this prompt.
          - When in doubt between a simple, boring, obviously-correct approach and a more impressive/creative one, ALWAYS choose the simple one.
          - Do NOT use animation libraries (Framer Motion, react-spring, etc.) unless a task explicitly requires complex animation. For hover/transition/micro-interaction polish, use plain Tailwind utilities only (transition, duration-*, hover:, focus:, ease-*). These cannot throw at runtime; animation libraries can (mismatched AnimatePresence keys, missing exit states, ref issues) and you will not be present to fix it.
          - Avoid clever patterns (HOCs, render props, dynamic component maps, complex generics, conditional hooks) in favor of plain, direct, linear code — even if it's a few lines longer. Obvious code is debuggable code; clever code is not, for this user.
          - Never add a feature, abstraction, or visual flourish that isn't explicitly required by architecturalResponsibilities, no matter how good it would look.

          ========================
          IMPORT EXTENSION MANDATE (ABSOLUTE — NO EXCEPTIONS, NO OBJECTIONS, CRITICAL)
          ========================
          EVERY relative import of a project file (any path starting with "./" or "../") MUST include the explicit file extension. This is non-negotiable regardless of standard TypeScript convention.
          - Importing a React component file → MUST end in ".tsx". Example: \`import List from "./components/List.tsx";\` — NOT \`from "./components/List"\`.
          - Importing a non-component file (hook, util, types, constants) → MUST end in ".ts" if that file has no JSX, or ".tsx" if it does.
          - This rule applies to default imports, named imports, and type-only imports alike.
          - This rule does NOT apply to npm package imports (e.g. "react", "lucide-react", "react-dom") — those stay exactly as their package name, with no extension.
          - When importing a file listed in PLANNED FILE ROLES or ALLOWED IMPORTS, take the extension directly from that file's actual filename in this changeset — do not guess or omit it.
          - Never write a relative import without an extension. There is no scenario in this task where an extensionless relative import is acceptable.

          ========================
          FILE GENERATION TASKS
          ========================
          You must generate code for EACH task listed below.

          Each task represents ONE file that must be created or modified.

          For every task:
          - Implement EVERY item in architecturalResponsibilities as real, working, user-visible behavior — not declared, not stubbed, not partially done.
          - Respect all constraints.
          - If task = "modify", output the FULL updated file. **CRITICAL:** You MUST preserve all existing functionality, exports, and logic from
          - If task = "create", generate a complete new file.

          Tasks:
          ${JSON.stringify(enrichedFilesWithMd, null, 2)}

          IMPORTANT:
          You MUST generate ONE output object for EACH task above.
          The number of output files MUST match the number of tasks.
          Return them in the same order.

          ========================
          SHARED CONTRACTS (CRITICAL — CROSS-FILE CONSISTENCY, #1 CAUSE OF "DOESN'T RENDER")
          ========================
          The files in this changeset are generated as separate tasks but must interoperate perfectly when combined. A mismatched export/prop here is the single most common reason generated code fails to render.
          - Any prop name, type/interface name, exported function signature, or import path referenced in PLANNED FILE ROLES or ALLOWED IMPORTS below is a CONTRACT, not a suggestion.
          - Before writing an import statement for any file listed in PLANNED FILE ROLES, restate to yourself (in your reasoning, not in the output): "this file exports ___ as a [default/named] export, with this exact shape: ___, and its filename extension is ___" — then write the import to match that EXACTLY, including the extension per the IMPORT EXTENSION MANDATE above. Do not guess.
          - If this file consumes something exported by another planned file (or exports something another planned file will consume), match its name, shape, and export style (default vs named) EXACTLY as implied by those sections.
          - Never invent an alternate prop name, alternate type shape, alternate signature, or alternate export style (default vs named) for anything shared across files in this changeset.

          ========================
          PLANNED FILE ROLES
          ========================
          These files are part of the same change set and may not exist yet.
          ${plannedFilesContext}
          **Batch Number**: ${i}

          ========================
          ALLOWED IMPORTS
          ========================
          ${allowedImportsContext}

          ========================
          UI DESIGN (TASK-SPECIFIC — STILL BOUND BY THE RELIABILITY MANDATE ABOVE)
          ========================
          This file is a USER-FACING UI component. Make it look clean, modern, and professional using Tailwind — good spacing, clear typography hierarchy, a sensible color palette, icons from lucide-react.

          You MAY decide layout, spacing, typography, color, and iconography.

          You MAY use simple Tailwind-only hover/focus/transition states.

          You MAY NOT:
          - Add new features, logic, or flows beyond the responsibilities.
          - Violate constraints.
          - Use animation libraries (see RELIABILITY MANDATE above).
          - Add visual flourish whose only purpose is to look impressive rather than to support a required behavior. A fade-in is decoration; a delete button must actually delete from state regardless of any decoration on it.

          The UI should feel like a real, clean product — not a flashy demo and not tutorial-bare.

          ========================
          IMPLEMENTATION RULES (MANDATORY)
          ========================
          1. "Prefer the simplest working solution" means the least complex code that still FULLY satisfies every responsibility — never a partial, stubbed, or fake implementation of one.
          2. Follow IMPLEMENTATION STEPS exactly — do not add extra features.
          3. Code MUST compile in React (Vite) + TypeScript strict mode.
          4. No unused imports, variables, props, or hooks.
          5. ZERO comments. None. Not "minimal," not "only where non-obvious" — zero. If the logic needs explaining, simplify the logic instead of explaining it.
          6. No console.logs, TODOs, or commented-out code.
          7. Clean naming and readable logic.
          8. Styling rules:
           - If creating a NEW file → Tailwind CSS only.
           - If modifying an EXISTING file → preserve existing styling approach.
          9. Iconography (STRICT): You MUST use 'lucide-react' for all icons. Do not use raw SVGs, Heroicons, FontAwesome, or any other library. Import components directly (e.g., \`import { Menu, X } from 'lucide-react';\`). Only use icon names you are certain exist in lucide-react; if unsure, use a well-known icon (e.g. Plus, X, Check, ChevronRight) rather than guessing an obscure name.
          10. Relative imports MUST carry an explicit extension (.tsx or .ts) per the IMPORT EXTENSION MANDATE — package imports remain extensionless.

          ========================
          STRICT OUTPUT FORMAT (JSON ONLY)
          ========================
          Return ONLY a valid JSON array. NO markdown. NO explanations. NO extra text.
          Output MUST start with [ and end with ]. No trailing commas.

          Schema:
          [
            {
              "fileName": "ExactFileName.tsx",
              "path": "src/relative/path/ExactFileName.tsx",
              "content": "FULL FILE CONTENT AS A JSON-ESCAPED STRING"
            }
          ]

          ========================
          JSON STRING ESCAPING (READ CAREFULLY — THIS IS THE #1 CAUSE OF PARSE FAILURES)
          ========================
          The "content" field is raw source code containing double quotes, backticks, template literals, JSX attribute strings, and regex. To stay valid JSON:
          - Every literal newline in the code → encode as \\n
          - Every double quote " appearing inside the code → encode as \\"
          - Every backslash \\ appearing inside the code (e.g. in a regex like \\d+) → encode as \\\\
          - Backticks and template-literal syntax are not special to JSON and need no extra escaping themselves — but any " or \\ that appear inside a template literal still follow the two rules above.
          - There must be NO literal, un-escaped newline and NO unescaped double quote anywhere inside a "content" string. This single mistake is the most common cause of JSON.parse() failure in this pipeline — check every "content" string character-by-character against these rules before moving to the next file.

          ========================
          FINAL VERIFICATION (DO NOT SKIP)
          ========================
          Before returning the response, verify the following:

          1. The output is valid JSON, parseable by JSON.parse(), with no unescaped quotes, backslashes, or raw newlines inside any "content" string.
          2. The JSON array contains exactly one object for each requested task, in the same order.
          3. Each object strictly follows the required schema.
          4. The "path" matches the requested target file; "fileName" matches the file name in the path.
          5. EVERY item in that task's architecturalResponsibilities maps to real, working code in "content" — none declared-but-missing, none stubbed, none half-done. If something can't be fully implemented as written, fix the code rather than silently dropping it.
          6. Where this file shares props, types, or signatures with another planned file, they match exactly per SHARED CONTRACTS — re-check export style (default vs named) specifically, since this is the most common mismatch.
          7. The generated code compiles in React (Vite) with TypeScript strict mode.
          8. JSX syntax is valid — every opening tag has a matching closing tag, every conditional render returns a valid node or null, no stray fragments.
          9. React Hooks rules are respected: no hooks inside conditionals/loops, all dependencies declared.
          10. Imports only reference allowed files, and no animation library is imported anywhere.
          11. No unused imports, variables, or props exist.
          12. ZERO comments, no TODOs, no console logs, no commented-out code remain anywhere.
          13. All icons used are imported exclusively from 'lucide-react', and every icon name used actually exists in that library.
          14. Mentally trace rendering this component with default/empty props: does it throw, or render cleanly?
          15. EVERY relative import in this file ends in an explicit ".tsx" or ".ts" extension — scan every "import ... from" line in the content string one by one and confirm none are missing it.

          If any rule fails, FIX the issue before producing the final JSON output.
        `;

        const messages: ChatCompletionMessageParam[] = [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ];

        let raw = "";

        try {
          try {
            const response = await Google_GenAI.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [
                {
                  role: "user",
                  parts: [{ text: systemPrompt }, { text: userMessage }],
                },
              ],
            });
            const text = response?.text?.trim() || "";
            raw = text.replace(/^(```[\w]*\n)|(\n```)$|(```)$/g, "").trim();
          } catch (err) {
            const completion = await AI_MODULE.chat.completions.create({
              model: "Llama-3.3-70B-Versatile",
              messages,
              temperature: 0.3,
              response_format: { type: "json_object" },
            });
            raw = completion.choices?.[0]?.message?.content || "{}";
          }

          let generatedCodeArray: ArchProjectCode[] = [];

          try {
            generatedCodeArray = this.extractAndParseJSON(raw);

            for (const generatedCode of generatedCodeArray) {
              const markdownG = generatedCode.path === "Bricks.md";

              if (markdownG) {
                markdownPlanner = {
                  ...markdownPlanner,
                  targetFile: "Bricks.md",
                  existingFileContent: generatedCode.content,
                };
              }
              const tempProcessId = processIdProvider();

              this.pushToUser("", projectId, userId, tempProcessId, "render");

              archSSEmanager.send(jobId, "file", {
                ...generatedCode,
                projectId,
              });

              const request = enrichedRequests[i].find((r) => r.targetFile === generatedCode.path);

              enrichedFiles.push({
                path: generatedCode.path,
                content: generatedCode.content,
                action: request?.task ?? "create",
              });
              this.pushToUser("", projectId, userId, tempProcessId, "complete");
            }
          } catch (err) {
            console.error("Invalid JSON from model:", raw);
          }

          // await this.handleMissingImports(generatedCode, planedScript);

          // planKeys = Object.keys(planedScript);
        } catch (error) {
          console.error("Error:", error);
        } finally {
          for (const [processId, req] of processMap) {
            this.pushToUser(
              `${req.task === "create" ? "Creating" : "Modifying"}: ${req.targetFile} • ${req.architecturalResponsibilities}`,
              projectId,
              userId,
              processId,
              "complete"
            );
          }
        }
      }

      const snapprocess = processIdProvider();
      this.pushToUser(`🛠️ snapshot is ready`, projectId, userId, snapprocess, "complete");

      const snapshotv1Id = await this.snapshot(
        snapshotEnum.ACTIVE,
        userId,
        projectId,
        parentFiles,
        null
      );
      const snapshotv2Id = await this.snapshot(
        snapshotEnum.DRAFT,
        userId,
        projectId,
        enrichedFiles,
        snapshotv1Id
      );
      this.pushToUser(`snapshot is ready`, projectId, userId, snapprocess, "complete");

      return { snapv1Id: snapshotv1Id, snapv2Id: snapshotv2Id } as any;
    } catch (error) {
      console.error("ArchCodeGenerator Failed:", error);
      return null;
    }
  }

  private static async snapshot(
    state: snapshotEnum,
    userId: mongoose.Types.ObjectId,
    projectId: mongoose.Types.ObjectId,
    files: snaps[],
    parentSnapshotId: mongoose.Types.ObjectId | null
  ): Promise<mongoose.Types.ObjectId | null> {
    try {
      const snap = await Snapshot.create({
        userId,
        projectId,
        parentSnapshot: parentSnapshotId,
        status: state,
      });

      if (!files.length) return snap._id;

      const bulkOps = files.map((file) => ({
        insertOne: {
          document: {
            userId,
            projectId,
            snapshotId: snap._id,
            path: file.path,
            content: file.content,
          },
        },
      }));

      await snapShotFile.bulkWrite(bulkOps);

      return snap._id;
    } catch (error) {
      console.error("Snapshot Failed:", error);
      return null;
    }
  }

  private static async handleMissingImports(
    generated: ArchProjectCode,
    plan: ProjectPlan
  ): Promise<void> {
    const imports = this.extractImports(generated.content);

    for (const imp of imports) {
      const path = this.resolveImportPath(imp);
      if (!path) continue;

      if (!plan[path]) {
        plan[path] = {
          responsibilities: [`Auto-generated dependency for ${generated.path}`],
          action: "create",
          role: "utility",
          executionOrder: 0,
        };
      }
    }
  }

  private static extractImports(content: string): string[] {
    const regex = /import\s+(?:[^;]+?)\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = regex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }

  private static resolveImportPath(imp: string): string | null {
    // Skip external packages
    if (!imp.startsWith("@/")) return null;

    let path = imp.replace("@/", "src/");
    if (!path.endsWith(".tsx")) {
      path += ".tsx";
    }
    return path;
  }

  private static async fileCodeProvider(
    filePath: string,
    projectId: mongoose.Types.ObjectId
  ): Promise<string> {
    try {
      const segments = filePath.split("/");
      const fileName = segments.pop();

      const dirPath = segments.length > 0 ? segments.join("/") : "."; // "src"
      const file = await ProjectFile.findOne({
        name: fileName,
        projectId,
        path: dirPath,
      });

      return file?.content ?? "";
    } catch (error) {
      console.error("Error in fileCodeProvider ArchEngin:", error);
      return "";
    }
  }

  private static async BricksMdFileProvider(
    projectId: Types.ObjectId,
    userId: Types.ObjectId,
    plannerScript: ProjectPlan,
    batches: number
  ): Promise<GenerationRequest> {
    const BRICKS_PATH = "Bricks.md";
    const now = new Date().toISOString();
    const plannerJson = JSON.stringify(plannerScript, null, 2);

    try {
      const file = await ProjectFile.findOne({ projectId, userId, path: ".", name: "Bricks.md" });
      const defaultContent = [
        `# Project State Journal (Bricks.md)`,
        `> **System Directive**: This file maps the dependency graph and architectural history.`,
        ``,
        `## Metadata`,
        `**Status**: In Progress`,
        `**Current Batch**: 1`,
        `**Total Batches**: ${batches}`,
        `**Last Updated**: ${now}`,
        ``,
        `## Export Registry (Compressed History)`,
        `*Format per entry: - \`path\`: exports \`Name\` (default|named) — propsOrSignature — one-line purpose*`,
        `*This registry is the ONLY source of truth for what already exists. It must contain enough detail that another AI could import from these files WITHOUT opening them.*`,
        `*(None yet)*`,
        ``,
        `## Current Batch Target`,
        `### Batch 1`,
        "(None yet)",
        ``,
      ].join("\n");

      if (!file || file.content?.includes("Ready for New Task")) {
        return {
          task: "create",
          targetFile: BRICKS_PATH, // ENFORCED BELOW — AI output for this field is ignored
          architecturalResponsibilities: [
            "ROLE: You are the strict File Initializer.",
            "ACTION: Output the exact provided existingFileContent into the target file without modifications.",
          ],
          constraints: [
            "**CRITICAL — NON-NEGOTIABLE**: The target path for this file is LOCKED and is supplied by the system, not chosen by you. Whatever value you put in the path/fileName field WILL BE DISCARDED and overwritten by the system. Do not waste effort deciding it — just echo the content back exactly.",
          ],
          existingFileContent: defaultContent,
        };
      }

      const existingContent: string = file.content ?? "";
      const batchMatch = /\*\*Current Batch\*\*:\s*(\d+)/.exec(existingContent);
      const previousBatch = batchMatch ? parseInt(batchMatch[1], 10) : 1;
      const nextBatch = previousBatch + 1;

      return {
        task: "modify",
        targetFile: BRICKS_PATH,
        architecturalResponsibilities: [
          `ROLE: You are the strict Context Compressor and State Manager.`,
          `STEP 1 - METADATA: Update "**Current Batch**" to ${nextBatch} and "**Last Updated**" to ${now}.`,
          `STEP 2 - COMPRESS HISTORY: Look at the previous 'Current Batch Target' JSON. For EVERY file in it, append ONE bullet under '## Export Registry (Compressed History)' using EXACTLY this format: "- \`<path>\`: exports \`<ExportName>\` (default|named) — props: <key props/signature, or 'none'> — <one-line purpose>". This registry is what future batches rely on to import correctly without re-reading the source — vague purpose-only bullets are USELESS, you must preserve the actual export name and shape.`,
          `STEP 3 - DELETE OLD JSON: Completely remove the previous Batch JSON block to save context window tokens — its information now lives in the registry bullets from STEP 2.`,
          `STEP 4 - APPEND NEW TARGET: Create '### Batch ${nextBatch}' under '## Current Batch Target' and insert this exact JSON:\n\`\`\`json\n${plannerJson}\n\`\`\``,
          `STEP 5 - OUTPUT: Return the full, newly compressed markdown document.`,
        ],
        constraints: [
          "ANTI-HALLUCINATION: Never invent files, exports, or props that weren't in the previous batch JSON.",
          "STRICT COMPRESSION: Do not retain old JSON objects. Each Export Registry bullet must follow the exact format given in STEP 2 — no free-form descriptions.",
          "**CRITICAL — NON-NEGOTIABLE**: The target path for this file is LOCKED and is supplied by the system, not chosen by you. Whatever value you put in the path/fileName field WILL BE DISCARDED and overwritten by the system. Do not waste effort deciding it — just return the markdown content.",
        ],
        existingFileContent: existingContent.toLowerCase().includes("ready for new task")
          ? defaultContent
          : existingContent,
      };
    } catch (error) {
      console.error("Error while getting Bricks.md: ", error);
      return {
        task: "modify",
        targetFile: BRICKS_PATH,
        architecturalResponsibilities: [
          "SYSTEM ERROR RECOVERY: A system error prevented loading historical project context.",
          `ACTION: Create an emergency batch append noting the time of failure (${now}) and append the new JSON plan.`,
        ],
        constraints: [
          "DO NOT HALLUCINATE PAST HISTORY. Acknowledge the missing history explicitly.",
          "Output the provided JSON exactly as given.",
          "**CRITICAL — NON-NEGOTIABLE**: The target path for this file is LOCKED and is supplied by the system. Any path/fileName you output WILL BE OVERWRITTEN.",
        ],
        existingFileContent: `# Project State Journal (Bricks.md)\n\n**Status**: Warning (History Load Failed)\n**Last Updated**: ${now}\n\n> **System Note**: Previous history could not be fetched due to an internal error.\n\n## Batch Log\n### Emergency Append\n\`\`\`json\n${plannerJson}\n\`\`\`\n`,
      };
    }
  }
  // #endregion

  private static pushToUser(
    message: string,
    projectId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    processId: string,
    state: "render" | "complete"
  ): void {
    try {
      ArchEnginStatusSocket.__push(
        {
          id: uIdProvider(),
          processId: processId,
          process: state,
          message: message,
        },
        userId
      );
    } catch (error) {
      console.error("Error in ArchPush TO User ArchEngin:", error);
      return;
    }
  }

  // #region ------ AI planner ------
  private static async archProjectPlanner(
    fileContexts: ArchFileContext[],
    projectTree: string,
    userPrompt: string,
    projectId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId
  ): Promise<ProjectPlan> {
    try {
      const processId = processIdProvider();
      this.pushToUser(
        "Analyzing project and planning required changes...",
        projectId,
        userId,
        processId,
        "render"
      );
      const optimizedContext = this.formatContextForPlanner(fileContexts);

      const enhancedSystemPrompt = `You are a Principal-Level Software Architect AND Elite Product Designer.
        ========================
        INPUT DATA
        ========================
        1. Project Tree: ${projectTree}
        2. Existing Exports: ${optimizedContext}
        3. User Request: "${userPrompt}"
        ========================
        PRIORITY HIERARCHY (READ FIRST — RESOLVES ANY CONFLICT BELOW)
        ========================
        1. DESIGN QUALITY and FULL FUNCTIONALITY are non-negotiable and come FIRST, always. This is the product's selling point — every screen must look premium and every feature must fully work, with zero exceptions.
        2. FILE STRUCTURE EFFICIENCY (fewer files, shallow dependencies, minimal diffs) is a SECONDARY engineering discipline about HOW you organize the code — it must NEVER be used as a reason to cut UI polish, simplify animations, skip a feature, or leave a handler unwired.
        If you ever feel tension between "fewer files" and "best possible UI/functionality" — fewer files loses. Put the full design and full functionality into however many files it genuinely takes to keep each file clean and correct. The file-structure rules only stop you from creating REDUNDANT files (e.g. a separate file for a one-line constant) — they never stop you from building the complete, polished feature.
        ========================
        STYLING ARCHITECTURE MANDATE (ABSOLUTE — NO EXCEPTIONS, EVER)
        ========================
        ALL styling, with no exception, MUST be implemented via Tailwind utility classes applied directly in component markup (className="...").
        - index.css (or any global stylesheet) and tailwind.config.* are CONFIGURATION FILES, not styling surfaces. Their existing setup is FROZEN for this task.
        - NEVER include index.css, tailwind.config.js/ts, postcss.config.*, or any global stylesheet/config file in the output — not as "create," not as "modify," not even a one-line addition — REGARDLESS of what the design seems to require.
        - NEVER add a new CSS file, a CSS Module, a styled-components/emotion block, inline style={{}} objects, or @apply/@layer custom classes to achieve an effect. If Tailwind's default utilities don't have a built-in class for something (a very rare case — almost everything has one: arbitrary values like w-[327px], bg-[#1a1a2e], or shadow-[0_4px_20px_rgba(0,0,0,0.1)] cover the rest), use Tailwind's bracket arbitrary-value syntax INLINE in className — never add it to a config or stylesheet.
        - If a design genuinely seems to need a new font, custom color token, or theme extension that isn't in the existing Tailwind config: do NOT add it. Re-solve the design using only what's already configured plus inline arbitrary values. A design constraint is not a valid reason to touch config.
        - This rule overrides the Design Mandate below wherever the two would conflict — premium design must be achieved entirely through utility classes in component files.
        ========================
        GLOBAL DESIGN MANDATE (CRITICAL & NON-NEGOTIABLE — HIGHEST PRIORITY)
        ========================
        Whenever the user requests new UI components, pages, or visual improvements, you MUST deliver a premium, production-grade interface — this is the core value proposition, not a nice-to-have.
        - ALWAYS use modern, high-end design patterns: thoughtful spacing/typography hierarchy, Tailwind utility-driven styling, glassmorphism/depth where appropriate, Framer Motion for meaningful micro-interactions and transitions.
        - ALWAYS design for real states: loading, empty, error, success, hover/focus/active — not just the happy path.
        - ALWAYS make it responsive and accessible (proper semantics, contrast, focus states).
        - NEVER output barebones, unstyled, or "default browser" HTML. NEVER ship a visually incomplete component to save a file.
        - All of the above must be achieved purely through Tailwind utility classes per the STYLING ARCHITECTURE MANDATE — never via index.css or config changes.
        ========================
        GLOBAL FUNCTIONALITY MANDATE (CRITICAL & NON-NEGOTIABLE — HIGHEST PRIORITY)
        ========================
        - ALWAYS fully resolve every verb/feature implied by the user's request — if they said it, it must work end-to-end.
        - ALWAYS specify how state is managed (local, context, backend) and make sure data actually flows between the files you create/modify.
        - ALWAYS wire every interactive element (buttons, forms, toggles) to real, working logic.
        - NEVER wire a UI element with a dead handler, a TODO, or a placeholder stub. NEVER simplify or omit a feature to keep the file count low.
        ========================
        FILE STRUCTURE MANDATE (SECONDARY — GOVERNS ORGANIZATION ONLY, NOT SCOPE OR QUALITY)
        ========================
        Architect this like a senior engineer doing a focused PR — not too fragmented, not a monolith. Aim for the number of files a senior dev would ACTUALLY create for this change.

        SPLIT a piece of logic into its own file when at least one is true:
        - It will be imported/reused by 2+ other files.
        - It is a genuinely distinct responsibility/domain (e.g. a data hook vs. a UI component vs. a utility).
        - Keeping it in the parent file would mix unrelated concerns or make that file unwieldy (~150-250 lines as a rough signal, not a hard cap — a richly designed component is allowed to run longer).
        - The user explicitly asked for a separate file.

        DO NOT split when:
        - It's a one-off type, constant, tiny handler, or small sub-component used only inside a single parent file — co-locate it there.
        - You're splitting purely "for organization" with no reuse or clarity justification.

        Additional efficiency rules (never at the expense of design/functionality above):
        - Before adding any file, scan the Project Tree and Existing Exports — if a suitable file already exists with the right responsibility, extend it instead of duplicating.
        - Prefer a shallow dependency graph (executionOrder chains of 1–2 levels) over deep multi-level chains.
        - When modifying an existing file, change what's required for the request, plus whatever polish/wiring is needed to make that change fully premium and fully functional — but don't refactor unrelated code that has nothing to do with this request.
        - NEVER touch a file unrelated to the request just to "improve" it.
        ========================
        NEGATIVE CONSTRAINTS & EXECUTION ORDER (STRICT MODULE RESOLUTION)
        ========================
        - NEVER redefine a component inline if it is being created in another file within this batch, or already exists in the Project Tree.
        - NEVER include index.css, any global stylesheet, or any Tailwind/PostCSS config file as a task in the output, under any action type.
        - You MUST map the correct dependency graph using the "dependencies" array and "executionOrder". If File B relies on File A, File A must have a lower executionOrder, and File B MUST list File A in its dependencies.
        - If a component is listed in "dependencies", you MUST use standard ES6 imports to pull it into the file. DO NOT rewrite its logic.
        ========================
        OUTPUT SCHEMA REQUIREMENTS
        ========================
        Output ONLY a strict JSON object mapping file paths to file contracts. Each contract must include:
        - "description": Brief purpose of the file.
        - "action": "create" | "modify" | "delete"
        - "executionOrder": Integer representing the build sequence (1 is built first).
        - "dependencies": Array of file paths this file needs to import from.
        - "responsibilities": Array of functional and UI directives — be specific about both the visual polish AND the working behavior expected. Every styling-related responsibility must be achievable via Tailwind utility classes alone.
        - "constraints": Array of file-specific negative constraints.
        Before finalizing: (1) confirm every requested feature and every UI surface is fully designed and fully wired — no gaps allowed; (2) confirm index.css/global stylesheets/Tailwind config are NOT present anywhere in the file list; (3) check the file list against the SPLIT/DO NOT SPLIT rules and merge any redundant file. Step 1 always wins over step 3; step 2 is a hard gate that always wins.
        === EXAMPLE ===
        {
          "src/components/List.tsx": {
            "description": "Premium animated list component with empty/loading states",
            "action": "create",
            "executionOrder": 1,
            "dependencies": [],
            "responsibilities": ["Render list UI with Framer Motion stagger animation", "Handle empty state with illustration/CTA", "Handle loading skeleton state"],
            "constraints": ["Do not fetch data here", "Use Tailwind utility classes only — no new CSS, no style props"]
          },
          "src/App.tsx": {
            "description": "Main application entry",
            "action": "modify",
            "executionOrder": 2,
            "dependencies": ["src/components/List.tsx"],
            "responsibilities": ["Import and render List component", "Manage and pass live state/data to List", "Wire all user actions to working handlers"],
            "constraints": ["NEGATIVE CONSTRAINT: DO NOT redefine the List component inline. You MUST import it.", "Use Tailwind utility classes only — no new CSS, no style props"]
          }
        }
`;
      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: enhancedSystemPrompt },
        {
          role: "user",
          content: `Based on the project tree and request, provide a COMPLETE, fully functional, and highly styled plan for: "${userPrompt}"`,
        },
      ];

      const completion = await AI_MODULE.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: messages,
        temperature: 0.1, // Keep this low so JSON formatting is strict, the prompt now handles the creativity.
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0]?.message?.content || "{}";
      const plan: ProjectPlan = JSON.parse(content);

      this.pushToUser("", projectId, userId, processId, "complete");
      return plan;
    } catch (error) {
      console.error(" ArchEngine Planner Error:", error);
      return {};
    }
  }

  // #endregion

  private static formatContextForPlanner = (files: ArchFileContext[]): string => {
    return files
      .map((f) => {
        return `File: ${f.context.filePath}
            Type: ${f.context.fileType}
            Exports: ${f.context.exports.join(", ")}`;
      })
      .join("\n---\n");
  };

  private static extractAndParseJSON(str: string): any[] {
    // Clean out any Non-Breaking Spaces the LLM
    const cleanedStr = str.replace(/\u00A0/g, " ");

    const startArr = cleanedStr.indexOf("[");
    const endArr = cleanedStr.lastIndexOf("]");
    const startObj = cleanedStr.indexOf("{");
    const endObj = cleanedStr.lastIndexOf("}");

    try {
      if (startArr !== -1 && endArr !== -1 && (startArr < startObj || startObj === -1)) {
        const arrStr = cleanedStr.slice(startArr, endArr + 1);
        return JSON.parse(arrStr);
      } else if (startObj !== -1 && endObj !== -1) {
        const objStr = cleanedStr.slice(startObj, endObj + 1);
        const parsedObj = JSON.parse(objStr);

        return [parsedObj];
      }
    } catch (e) {
      console.error("Failed to parse LLM JSON:", e, "Raw output:", cleanedStr);
      return [];
    }

    return [];
  }
}
