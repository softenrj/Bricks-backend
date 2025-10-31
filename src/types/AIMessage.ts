export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  image?: string | ArrayBuffer | undefined
  isNew?: boolean;
  timestamp?: string;
}