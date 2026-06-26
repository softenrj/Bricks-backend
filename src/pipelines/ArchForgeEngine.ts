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
import { codeGenPrompt, folderStructurePrompt, promptCraftMaster } from "./ArchPrompts.js";
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

type ProjectPlan = {
  [filePath: string]: {
    action: "create" | "modify";
    role: "app-entry" | "page" | "layout" | "component" | "state" | "utility";
    responsibilities: string[];
    constraints?: string[];
    inputs?: string[];
    outputs?: string[];
  };
};

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

type GenerationRequest = {
  task: "create" | "modify";
  targetFile: string;
  architecturalResponsibilities: string[];
  constraints: string[];
  existingFileContent: string | null;
};
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
      let planKeys = Object.entries(planedScript)
        .sort(([, a], [, b]) => {
          if (a.action === "create" && b.action === "modify") return -1;
          if (a.action === "modify" && b.action === "create") return 1;
          return 0;
        })
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
      let markdownPlanner = await this.BricksMdFileProvider(projectId, userId, planedScript);

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

        const systemPrompt = codeGenPrompt;

        const userMessage = `
          You are a Principal-Level Senior React + TypeScript Architect.

          ========================
          FILE GENERATION TASKS
          ========================
          You must generate code for EACH task listed below.

          Each task represents ONE file that must be created or modified.

          For every task:
          - Implement EVERY item in architecturalResponsibilities as real, working, user-visible behavior — not declared, not stubbed, not partially done.
          - Respect all constraints.
          - If task = "modify", rewrite the FULL file using existingFileContent as the base.
          - If task = "create", generate a complete new file.

          Tasks:
          ${JSON.stringify(enrichedFilesWithMd, null, 2)}

          IMPORTANT:
          You MUST generate ONE output object for EACH task above.
          The number of output files MUST match the number of tasks.
          Return them in the same order.

          ========================
          SHARED CONTRACTS (CRITICAL — CROSS-FILE CONSISTENCY)
          ========================
          The files in this changeset are generated as separate tasks but must interoperate perfectly when combined.
          - Any prop name, type/interface name, exported function signature, or import path referenced in PLANNED FILE ROLES or ALLOWED IMPORTS below is a CONTRACT, not a suggestion.
          - If this file consumes something exported by another planned file (or exports something another planned file will consume), match its name, shape, and export style (default vs named) EXACTLY as implied by those sections.
          - Never invent an alternate prop name, alternate type shape, or alternate signature for anything shared across files in this changeset.

          ========================
          PLANNED FILE ROLES
          ========================
          These files are part of the same change set and may not exist yet.
          ${plannedFilesContext}

          ========================
          ALLOWED IMPORTS
          ========================
          ${allowedImportsContext}

          ========================
          UI DESIGN FREEDOM (TASK-SPECIFIC)
          ========================
          This file is a USER-FACING UI component.

          You are FREE and ENCOURAGED to use your full creativity to design
          a visually outstanding, modern, clean, and professional UI.

          You MAY creatively decide:
          - Layout and spacing
          - Typography hierarchy
          - Color palette and gradients
          - Visual emphasis and depth
          - Subtle animations and micro-interactions
          - Hover and focus states

          The UI should feel like a real product, not tutorial code.

          BOUNDARIES:
          - Do NOT add new features, logic, or flows beyond the responsibilities.
          - Do NOT violate constraints.
          - Any state or animation must exist ONLY to improve UI/UX, and must never be a substitute for an actual required behavior (e.g. a fade-in on a "delete" button is decoration; the delete must still really remove the item from state).

          ========================
          IMPLEMENTATION RULES (MANDATORY)
          ========================
          1. "Prefer the simplest working solution" means the least complex code that still FULLY satisfies every responsibility — never a partial, stubbed, or fake implementation of one.
          2. Follow IMPLEMENTATION STEPS exactly — do not add extra features.
          3. Code MUST compile in React (Vite) + TypeScript strict mode.
          4. No unused imports, variables, props, or hooks.
          5. No console.logs, TODOs, commented code, or noise.
          6. Minimal comments — only where logic is non-obvious.
          7. Clean naming and readable logic.
          8. Styling rules:
           - If creating a NEW file → Tailwind CSS only.
           - If modifying an EXISTING file → preserve existing styling approach.

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
          6. Where this file shares props, types, or signatures with another planned file, they match exactly per SHARED CONTRACTS.
          7. The generated code compiles in React (Vite) with TypeScript strict mode.
          8. JSX syntax is valid.
          9. React Hooks rules are respected.
          10. Imports only reference allowed files.
          11. No unused imports, variables, or props exist.
          12. No TODOs, console logs, or commented-out code remain.

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
    plannerScript: ProjectPlan
  ): Promise<GenerationRequest> {
    const BRICKS_PATH = "Bricks.md";
    const now = new Date().toISOString();
    const plannerJson = JSON.stringify(plannerScript, null, 2);

    try {
      const file = await ProjectFile.findOne({ projectId, userId, path: ".", name: "Bricks.md" });

      if (!file) {
        const defaultContent = [
          `# Project Plan `,
          ``,
          `**Status**: In Progress`,
          `**Current Batch**: 1`,
          `**Last Updated**: ${now}`,
          ``,
          `## Batch 1 - Initial Requirements`,
          "```json",
          plannerJson,
          "```",
          ``,
          `## Completed Files`,
          `(none yet)`,
          ``,
        ].join("\n");

        return {
          task: "create",
          targetFile: BRICKS_PATH,
          architecturalResponsibilities: [
            "Create the initial project journal exactly as provided in existingFileContent. Do not summarize or alter it.",
          ],
          constraints: ["Preserve formatting and JSON block exactly as given."],
          existingFileContent: defaultContent,
        };
      }

      const existingContent: string = file.content ?? "";
      const batchMatch = existingContent.match(/\*\*Current Batch\*\*:\s*(\d+)/);
      const previousBatch = batchMatch ? parseInt(batchMatch[1], 10) : 1;
      const nextBatch = previousBatch + 1;

      const instructions = [
        `Update this project journal to reflect Batch ${nextBatch}.`,
        `1. Update "**Current Batch**" to ${nextBatch} and "**Last Updated**" to ${now}.`,
        `2. Keep every previous "## Batch N" section intact — this is a history log, never delete past entries.`,
        `3. Append a new "## Batch ${nextBatch}" section containing this batch's plan as a JSON code block:\n${plannerJson}`,
        `4. Under "## Completed Files", add the files that were generated in the previous batch (derive this from the previous batch's plan) so the next agent run knows what already exists and won't redo or conflict with it.`,
        `5. Do not invent project history that wasn't in the existing content or this batch's plan.`,
      ];

      return {
        task: "modify",
        targetFile: BRICKS_PATH,
        architecturalResponsibilities: instructions,
        constraints: [
          "Never delete or rewrite prior Batch sections. Only append new ones and update the status header.",
        ],
        existingFileContent: existingContent,
      };
    } catch (error) {
      console.error("Error while getting Bricks.md: ", error);
      return {
        task: "modify",
        targetFile: BRICKS_PATH,
        architecturalResponsibilities: [
          "Could not load existing project history due to an internal error — append a note flagging this gap, do not fabricate missing history.",
        ],
        constraints: [""],
        existingFileContent: `# Project Plan \n\n**Status**: Unknown (history load failed)\n**Last Updated**: ${now}\n`,
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
        GLOBAL DESIGN MANDATE (CRITICAL & NON-NEGOTIABLE)
        ========================
        Whenever the user requests new UI components, pages, or visual improvements (e.g., "beautiful", "modern"), you MUST explicitly inject premium styling responsibilities into the output.
        - ALWAYS include directives for modern, high-end design (e.g., "Implement premium glassmorphism UI", "Use Tailwind for a polished dark-mode aesthetic", "Add Framer Motion for smooth layout transitions").
        - NEVER output barebones functional HTML. Functionality and stunning UI must coexist.

        ========================
        GLOBAL FUNCTIONALITY MANDATE (CRITICAL & NON-NEGOTIABLE — EQUAL PRIORITY TO DESIGN)
        ========================
        Beautiful UI on top of broken or incomplete logic is a FAILED output. Treat this with the same rigor as the Design Mandate.
        - ALWAYS fully resolve every verb/feature implied by the user's request into concrete, working behavior — not just the ones explicitly spelled out. If the user names an app archetype (todo list, calculator, login form, cart, kanban board, etc.), you MUST infer and include the full standard operation set for that archetype, even if the user only described it in one sentence.
          - Example inference rule: "todo app" implies add, toggle-complete, delete, edit, and an empty state — ALL of them, not just "add".
        - ALWAYS specify *how* state is managed and persisted (local component state, localStorage, context, backend) — never leave this implicit as "manage with state."
        - ALWAYS account for edge cases relevant to the feature: empty states, validation (e.g. don't allow blank submissions), loading states, error states, disabled/active button states.
        - NEVER wire a UI element (button, input, toggle) that has no real handler behind it. No dead clicks, no decorative-only interactivity, no "onClick={() => {}}" placeholders.
        - NEVER let styling responsibilities crowd out or replace functional responsibilities in the "responsibilities" array — both must be present, as distinct, specific bullet points.

        ========================
        MANDATORY: CLASSIFY THE REQUEST
        ========================
        Classify the user request into ONE primary type to determine the structural approach. Both mandates above apply to ALL of them:

        **"ui-only"** (VISUAL REFINEMENT):
        - Keywords: beautiful, animated, modern, aesthetic, redesign.
        - Rule: Modify existing files only. Focus heavily on animations, spacing, colors, and layout. Do NOT change or strip out any existing functional behavior while restyling — explicitly note "preserve existing functionality" in constraints.

        **"architectural"** (NEW PAGES / COMPLEX FEATURES):
        - Keywords: new page, todo app, new screen, routing.
        - Rule: Create necessary files and wire routing. Every new file must carry BOTH premium UI responsibilities AND a complete, granular functional spec (see Functionality Mandate above).

        **"behavioral"** (LOGIC / STATE + UX):
        - Keywords: on click, form, calculate, functionality.
        - Rule: Add logic and state. Specify exact state shape and transitions. Ensure any UI feedback (success messages, loaders, errors) includes smooth transitions and polished styling.

        ========================
        PRE-OUTPUT SELF-CHECK (DO NOT SKIP, DO NOT OUTPUT THIS SECTION)
        ========================
        Before writing the final JSON, silently verify for every file in your plan:
        1. Can a real user perform every action implied by their request, end-to-end, without a broken or missing handler?
        2. Does every interactive element have a named, specific behavior attached (not "handle click" — say what happens)?
        3. Is there an explicit empty/error/loading state where relevant?
        4. Is state persistence explicitly named (local state / localStorage / backend)?
        5. Does the file ALSO carry premium styling responsibilities distinct from the functional ones?
        If any answer is "no" or "vague," revise the responsibilities array before finalizing. Only output the final JSON — never show this checklist to the user.

        ========================
        EXAMPLE OUTPUTS (Notice styling AND functionality are both injected, as separate concrete bullets)
        ========================

        === EXAMPLE 1: Architectural + Beautiful request ===
        Request: "Add a new page to build a super beautiful fictional todo app"
        Output:
        {
          "src/App.tsx": {
            "description": "Wire new Todo page into application routing",
            "action": "modify",
            "role": "app-entry",
            "responsibilities": [
              "Add route for Todo page",
              "Ensure navigation transitions smoothly to the new route"
            ],
            "constraints": ["Keep existing routes intact"]
          },
          "src/pages/TodoPage.tsx": {
            "description": "Create premium, fully functional Todo page",
            "action": "create",
            "role": "page",
            "responsibilities": [
              "Render a stunning, modern Todo list UI using Tailwind CSS with a glassmorphic dark aesthetic",
              "Add Framer Motion layout animations when items are added or removed",
              "Implement add-todo via text input + Enter key or button click, with validation that blocks empty/whitespace-only submissions",
              "Implement toggle-complete on each item with a strikethrough/checkbox animation",
              "Implement delete-todo per item with an exit animation",
              "Implement inline edit-todo on double-click or edit icon",
              "Persist todo list to localStorage so items survive a page refresh",
              "Render a distinct, styled empty state when the list has zero items"
            ],
            "constraints": ["No backend integration required", "All listed operations must be fully wired and working, not mocked"]
          }
        }

        ========================
        NOW ANALYZE THE CURRENT REQUEST
        ========================
        Request: "${userPrompt}"

        Output ONLY a strict JSON object mapping file paths to file contracts.
        Every file's "responsibilities" array must contain BOTH premium UI styling bullets AND granular, fully-working functional bullets covering every operation implied by the request and its app archetype. Vague functional bullets (e.g. "manage state", "handle logic") are not acceptable — be specific about the exact behavior.
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
