import Groq from "groq-sdk";
import { GoogleGenAI } from "@google/genai";
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const AI_MODULE = groq;
export const Google_GenAI = ai;
