import { GoogleGenAI } from "@google/genai";

const getClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    console.warn("Gemini API Key is missing.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const suggestAlternativeTitles = async (
  currentTitle: string,
  keywords: string[]
): Promise<string[]> => {
  const ai = getClient();
  if (!ai) return [];

  try {
    const prompt = `
      Act as a professional SEO copywriter for a tax accounting agency.
      The current title is: "${currentTitle}".
      The target keywords are: ${keywords.join(", ")}.
      
      Please generate 3 alternative, high-converting blog post titles based on this context. 
      Return ONLY the titles as a simple JSON array of strings. Do not include markdown formatting.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const text = response.text || "[]";
    // Attempt to parse JSON from the response (handling potential markdown wrapping)
    const jsonMatch = text.match(/\[.*\]/s);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return [];
  } catch (error) {
    console.error("Error generating titles:", error);
    return [];
  }
};
