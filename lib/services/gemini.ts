import "server-only";
import { GoogleGenAI } from "@google/genai";
import { AI_MAX_OUTPUT_TOKENS, clampWords } from "@/lib/ai/prompt";

export interface ChatTurn { role: "user" | "assistant"; content: string }

export async function generateReply(systemInstruction: string, turns: ChatTurn[]): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY no configurada");
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: turns.map((t) => ({ role: t.role === "assistant" ? "model" : "user", parts: [{ text: t.content }] })),
    config: {
      systemInstruction,
      maxOutputTokens: AI_MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const text = res.text?.trim();
  if (!text) throw new Error("Respuesta vacía del modelo");
  return clampWords(text);
}
