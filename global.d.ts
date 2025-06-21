// This file provides ambient type declarations for modules loaded via import maps,
// allowing TypeScript to compile without having these packages in node_modules.
// These are minimal stubs to satisfy the compiler; full type safety depends
// on the actual library loaded at runtime.

declare module '@google/generative-ai' {
  export interface GenerateContentResponse {
    text(): string;
    // Minimal stub. Add other properties if they are accessed directly from the response.
    // e.g., candidates?: Array<{ groundingMetadata?: { groundingChunks?: Array<{ web: { uri: string; title: string; } }> } }>;
  }

  export interface GenerateContentRequest {
    model: string;
    contents: any; // Can be string or { parts: Array<any> }
    config?: {
        systemInstruction?: string;
        topK?: number;
        topP?: number;
        temperature?: number;
        responseMimeType?: string;
        seed?: number;
        thinkingConfig?: { thinkingBudget?: number };
        tools?: Array<any>; // e.g., [{googleSearch: {}}]
    };
  }
  
  export interface GenerateImageRequest {
    model: string;
    prompt: string;
    config?: {
        numberOfImages?: number;
        outputMimeType?: 'image/png' | 'image/jpeg'; // And potentially others
    };
  }

  export interface GeneratedImage {
    image: { imageBytes: string }; // Base64 encoded image bytes
    // other properties if needed
  }

  export interface GenerateImageResponse {
    generatedImages: GeneratedImage[];
  }

  export class GoogleGenerativeAI {
    constructor(apiKey: string);

    getGenerativeModel(params: { model: string }): GenerativeModel;
  }

  export interface GenerativeModel {
    generateContent(prompt: string): Promise<{ response: GenerateContentResponse }>;
    generateContentStream(prompt: string): Promise<AsyncIterable<GenerateContentResponse>>; // For streaming
    generateImages(params: GenerateImageRequest): Promise<GenerateImageResponse>;
    // Add other model methods if used, e.g., countTokens, embedContent
  }

  export interface Chat {
    sendMessage(params: { message: any }): Promise<GenerateContentResponse>; // 'message' can be string or { parts: ... }
    sendMessageStream(params: { message: any }): Promise<AsyncIterable<GenerateContentResponse>>;
    getHistory(): Promise<Array<any>>; // Define history item structure if needed
  }

  // Add other specific types if they are imported and used directly,
  // e.g., HarmCategory, HarmBlockThreshold, Part, etc.
}
