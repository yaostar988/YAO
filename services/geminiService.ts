import { GoogleGenAI, Chat, GenerateContentResponse, Part } from "@google/genai";
import { Message } from '../types';

let genAI: GoogleGenAI | null = null;

const getGenAI = () => {
  if (!genAI) {
    // Vite will replace process.env.API_KEY with the actual value during build
    genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }
  return genAI;
};

export const createChatStream = async (
  history: Message[],
  newMessage: string,
  attachment: { mimeType: string; data: string } | undefined,
  onChunk: (text: string) => void
): Promise<string> => {
  try {
    const ai = getGenAI();
    
    const chat: Chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: "You are a helpful, intelligent assistant in a modern social app. Keep responses concise and engaging. You can analyze images if provided.",
      },
    });

    // Construct the message payload
    let messageContent: string | Part[] = newMessage;

    if (attachment && attachment.mimeType.startsWith('image/')) {
        // Strip base64 header if present (e.g., "data:image/png;base64,")
        const base64Data = attachment.data.includes('base64,') 
            ? attachment.data.split('base64,')[1] 
            : attachment.data;

        messageContent = [
            { text: newMessage || "Analyze this image" },
            { inlineData: { mimeType: attachment.mimeType, data: base64Data } }
        ];
    } else if (attachment) {
         // Fallback for non-image files if we want to inform the bot
         messageContent = `[User sent a file: ${attachment.mimeType}]. ${newMessage}`;
    }

    const resultStream = await chat.sendMessageStream({ message: messageContent });

    let fullText = "";
    for await (const chunk of resultStream) {
      const c = chunk as GenerateContentResponse;
      if (c.text) {
        fullText += c.text;
        onChunk(fullText);
      }
    }
    return fullText;

  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};