// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string | ArrayBuffer | undefined;
  isNew?: boolean;
  timestamp?: string;
}
