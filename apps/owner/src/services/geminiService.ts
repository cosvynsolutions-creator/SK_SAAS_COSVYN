import { geminiGenerateCallable } from "./firebase";
import { ChartDataPoint } from "../types";

/**
 * Generates financial insights using server-side Gemini Cloud Function (Phase 3).
 * Requires authenticated user session and enforces server-side rate limits.
 * GEMINI_API_KEY is securely held in Firebase Secret Manager, never in the client bundle.
 */
export const generateBusinessInsights = async (data: ChartDataPoint[]): Promise<string> => {
  try {
    if (!data || data.length === 0) return "Not enough data to generate insights yet.";
    
    // Filter out inactive periods
    const activeData = data.filter(d => (d.value || 0) > 0 || (d.secondaryValue || 0) > 0);
    if (activeData.length === 0) return "Gathering data to provide your first AI insight...";
    
    const response = await geminiGenerateCallable({
      action: 'business_insights',
      data: activeData
    });

    return response.data?.text || "Unable to generate insights at this time.";
  } catch (error: any) {
    console.error("Gemini Insight Error:", error);
    return "AI insights are currently warming up. Check back in a moment!";
  }
};

/**
 * Generates automated customer support replies via server-side Gemini Cloud Function (Phase 3).
 */
export const generateSupportReply = async (customerQuery: string): Promise<string> => {
  try {
    if (!customerQuery || !customerQuery.trim()) {
      return "Please enter a message to generate a reply.";
    }

    const response = await geminiGenerateCallable({
      action: 'support_reply',
      customerQuery: customerQuery.trim()
    });

    return response.data?.text || "I'm sorry, I couldn't generate a response.";
  } catch (error: any) {
    console.error("Gemini Support Error:", error);
    return "Error connecting to AI support assistant.";
  }
};