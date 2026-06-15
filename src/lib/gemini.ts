import { GoogleGenAI, Type } from "@google/genai";

let currentApiKey = process.env.GEMINI_API_KEY || "";
let ai = new GoogleGenAI({ apiKey: currentApiKey });

export function setGeminiApiKey(key: string) {
  if (key && key !== currentApiKey) {
    currentApiKey = key;
    ai = new GoogleGenAI({ apiKey: key });
  } else if (!key && process.env.GEMINI_API_KEY) {
    currentApiKey = process.env.GEMINI_API_KEY;
    ai = new GoogleGenAI({ apiKey: currentApiKey });
  }
}

export interface RedNotePost {
  title: string;
  body: string;
  englishTitle: string;
  englishBody: string;
  tags: string[];
  imagePrompts: string[];
  location?: string;
}

export interface RedNoteRating {
  copywriting: number;
  visualPotential: number;
  trendiness: number;
  engagement: number;
  overallScore: number;
  feedback: string[];
}

export type Platform = "xhs" | "wechat";

export async function generateContent(platform: Platform, topic: string, mood: string, audience: string, ageGroup?: string, location?: string, persona?: string, refinement?: string, targetCharacters?: number, inspirationContext?: string): Promise<RedNotePost> {
  const isWeChat = platform === "wechat";
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `You are a viral ${isWeChat ? "WeChat Official Account editor" : "RedNote creator"}. 
    
    AUTHOR IDENTITY: 
    ${persona ? `The author IS: "${persona}". Write exactly from their perspective, using their name if natural, their specific brand voice, and their unique worldview.` : "A generic but high-engagement professional digital publisher."}

    ${inspirationContext ? `INSPIRATION CONTEXT (Self-Understanding): "${inspirationContext}". 
    This is the core value/reflection the author wants to express. DO NOT just write copy; TRANSLATE this authentic feeling into the platform's format.` : ""}

    TOPIC: "${topic}". 
    Mood/Aesthetic: ${mood}. 
    Target Audience Niche: ${audience}. 
    Age Demographic Target: ${ageGroup || "All ages balanced"}.
    ${targetCharacters ? `TARGET CHARACTER COUNT: Approximately ${targetCharacters} Chinese characters.` : ""}
    ${refinement ? `REFINEMENT INSTRUCTION (CRITICAL): ${refinement}. Adjust the previous draft to follow this instruction exactly.` : ""}

    OUTPUT REQUIREMENTS:
    - A catchy, ${isWeChat ? "sophisticated and intriguing" : "click-baity"} Chinese title (use emojis).
    - The main body text in Chinese, optimized for ${platform.toUpperCase()}: 
      ${isWeChat ? `Use an 'official account' style: Professional and well-structured, aiming for ${targetCharacters || 800} Chinese characters.
      CRITICAL FOR WECHAT: DO NOT use any markdown symbols or markdown formatting markers under any circumstances (absolutely NO hashtags/symbols like '#', '##', '###', '**', '*', '__', '_', etc.). All sections and headings must be written as clean, plain-text sentences or labels (such as "1. Heading Title") separated by double newlines (\n\n) only.` : `Use a 'RedNote' style: Short paragraphs, high-energy emojis, conversational layout, aiming for ${targetCharacters || 300} Chinese characters.`}
    - An English translation of the body text (keep the same structure and tone; if generating for WeChat, also strictly follow the raw plain text formatting with absolutely NO markdown symbols).
    - 5-8 trending hashtags (if WeChat, output these as simple plain text list or words without markdown bold or headers).
    - 3 image description prompts that match the aesthetic (WRITE THESE IN ENGLISH).
    - If a location was provided, incorporate it naturally into the copy and include it as a "location" field in the JSON.
    
    CRITICAL: The content MUST strictly follow the AUTHOR IDENTITY provided. Adjust the vocabulary, tone (e.g., highly professional, Gen-Z slang, witty, minimalist), and storytelling perspective to match this role exactly. Do not include markdown headers or symbols anywhere in the response if platform is WeChat.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          body: { type: Type.STRING },
          englishTitle: { type: Type.STRING },
          englishBody: { type: Type.STRING },
          tags: { type: Type.ARRAY, items: { type: Type.STRING } },
          imagePrompts: { type: Type.ARRAY, items: { type: Type.STRING } },
          location: { type: Type.STRING },
        },
        required: ["title", "body", "englishTitle", "englishBody", "tags", "imagePrompts"],
      },
    },
  });

  const post = JSON.parse(response.text) as RedNotePost;
  if (isWeChat) {
    post.title = stripMarkdown(post.title);
    post.body = stripMarkdown(post.body);
    if (post.englishTitle) post.englishTitle = stripMarkdown(post.englishTitle);
    if (post.englishBody) post.englishBody = stripMarkdown(post.englishBody);
  }
  return post;
}

export async function translateToPlatformStyle(platform: Platform, englishTitle: string, englishBody: string, persona?: string): Promise<{title: string, body: string}> {
  const isWeChat = platform === "wechat";
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `You are an expert ${platform.toUpperCase()} content creator. 
    Translate the provided English title and body into a ${isWeChat ? "professional WeChat Official Account article" : "viral RedNote (Xiaohongshu) post"} style in Chinese.
    ${persona ? `Maintain this Author Identity: ${persona}.` : ""}
    - For WeChat: Use structured paragraphs, headings if needed, and a professional, plain-text tone. CRITICAL: Do not use any markdown formatting or markdown symbols at all (no headings starting with '#', no bold '**' or '__', no italics, etc.). Headings must be normal sentences/text separated by double-newlines (\n\n).
    - For RedNote: Use catchy titles, conversational tone, and high-energy emojis.
    - Output exactly as JSON with "title" and "body" keys.

    English Title: ${englishTitle}
    English Body: ${englishBody}` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          body: { type: Type.STRING }
        },
        required: ["title", "body"]
      }
    }
  });

  const parsed = JSON.parse(response.text);
  if (isWeChat) {
    parsed.title = stripMarkdown(parsed.title);
    parsed.body = stripMarkdown(parsed.body);
  }
  return parsed;
}

export async function refineInspiration(rawNote: string, persona?: string): Promise<{ clarifiedConcept: string; suggestedTopic: string }> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `
      Act as an Empathetic Editor & Content Architect. 
      The user has provided a raw, perhaps blurry, inspiration or diary snippet. 
      Your goal is to help them understand their own value and "unblur" the feeling to find a clear content angle.
      
      User Persona: ${persona || "Individual seeking authentic expression"}
      Raw Inspiration: "${rawNote}"
      
      Tasks:
      1. Analyze the core "Aha!" moment or deep emotion in this note.
      2. Synthesize it into a "Clarified Concept" (2-3 sentences) that explains the underlying value to a reader.
      3. Suggest a punchy "Suggested Topic" for a social media post.
      
      Output exactly as JSON with "clarifiedConcept" and "suggestedTopic" keys.
    ` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          clarifiedConcept: { type: Type.STRING },
          suggestedTopic: { type: Type.STRING }
        },
        required: ["clarifiedConcept", "suggestedTopic"]
      }
    }
  });

  return JSON.parse(response.text);
}

export interface ContentStrategy {
  analysis: string;
  recommendations: {
    title: string;
    description: string;
    reason: string;
    suggestedMood: string;
  }[];
}

export async function recommendNextSteps(history: string[], persona?: string): Promise<ContentStrategy> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `
      Act as a Social Media Strategist. Analyze the following post history and persona.
      Your goal is to suggest 3 diverse "What to Post Next" ideas that avoid repetition and feed fatigue.
      
      Persona: ${persona || "General Creator"}
      History: ${history.length > 0 ? history.join(", ") : "Empty history"}

      Analysis Requirements:
      1. Identify the current "Tone" or "Niche" dominant in history.
      2. Spot repetitive patterns (e.g., "Too many tutorials", "All food posts").
      3. Suggest "Counter-move" content to break the pattern (e.g., if history is technical, suggest behind-the-scenes).

      Output JSON with "analysis" (1 sentence summary) and "recommendations" (list of 3 objects).
    ` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          analysis: { type: Type.STRING },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                description: { type: Type.STRING },
                reason: { type: Type.STRING },
                suggestedMood: { type: Type.STRING }
              },
              required: ["title", "description", "reason", "suggestedMood"]
            }
          }
        },
        required: ["analysis", "recommendations"]
      }
    }
  });

  return JSON.parse(response.text);
}

export interface MatrixItem {
  id: string;
  title: string;
  day: number;
  mood: string;
  audience: string;
  reasoning: string;
}

export async function generateContentMatrix(history: string[], persona?: string, count: number = 12): Promise<MatrixItem[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: "user", parts: [{ text: `
      Act as a Content Strategist. Create a ${count}-post content matrix for the next month.
      
      Persona: ${persona || "Creative Professional"}
      History: ${history.length > 0 ? history.join(", ") : "New account"}
      
      Strategy:
      1. CRITICAL: Avoid repeating topics in History. 
      2. Variety: Mix educational, inspirational, personal, and promotional posts.
      3. Logic: Each post should follow a logical progression for the month.
      
      Output exactly as JSON array of objects with:
      - id: unique string
      - title: punchy post title
      - day: suggested day of month (1-30)
      - mood: suggested mood string
      - audience: targeted sub-audience
      - reasoning: why this post fits the sequence
    ` }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            day: { type: Type.NUMBER },
            mood: { type: Type.STRING },
            audience: { type: Type.STRING },
            reasoning: { type: Type.STRING }
          },
          required: ["id", "title", "day", "mood", "audience", "reasoning"]
        }
      }
    }
  });

  return JSON.parse(response.text);
}

export async function suggestRefinements(platform: Platform, post: RedNotePost): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Based on this ${platform} content, suggest 4 short, distinct refinement directions in English (max 5 words each) to improve it or change its vibe.
    
    Content Title: ${post.title}
    Content Body: ${post.body}
    
    Output exactly 4 suggestions as a JSON array of strings in English.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING }
      }
    }
  });
  return JSON.parse(response.text);
}

export async function rateContent(platform: Platform, post: RedNotePost, topic: string): Promise<RedNoteRating> {
  const isWeChat = platform === "wechat";
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Rate the following ${isWeChat ? "WeChat Official Account article" : "RedNote post"} about "${topic}" based on ${isWeChat ? "professional digital publishing standards" : "RedNote algorithm standards"} (0-100 scale):
    Title: ${post.title}
    Body: ${post.body}
    Tags: ${post.tags.join(", ")}
    
    Dimensions:
    1. Copywriting: How ${isWeChat ? "authoritative and well-structured" : "punchy and conversational"} it is.
    2. Visual Potential: How much the text/concept inspires ${isWeChat ? "professional illustrations" : "high-quality photos"}.
    3. Trendiness: Alignment with current ${isWeChat ? "industry or social" : "social media"} trends.
    4. Engagement: Likelihood of users ${isWeChat ? "bookmarking or sharing in groups" : "commenting/sharing"}.
    
    Also provide exactly 3 concise "viral insights" (max 15 words each) explaining why this content will perform well or how to improve it.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          copywriting: { type: Type.NUMBER },
          visualPotential: { type: Type.NUMBER },
          trendiness: { type: Type.NUMBER },
          engagement: { type: Type.NUMBER },
          overallScore: { type: Type.NUMBER },
          feedback: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ["copywriting", "visualPotential", "trendiness", "engagement", "overallScore", "feedback"],
      },
    },
  });

  return JSON.parse(response.text);
}

export async function suggestTopicsFromHistory(history: string[]): Promise<string[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on the following list of topics the user has previously optimized for RedNote: "${history.join(", ")}".
      
      Suggest 6 new, HIGHLY RELEVANT content angles that would perform well on social media. 
      Instead of just listing related activities, think about specific "vibe" hooks, tutorials, or lifestyle angles.
      
      Example angles:
      - "The Beginner's Aesthetic Guide to [Topic]"
      - "[Topic] Vibe Check: Why I'm obsessed"
      - "3 things I wish I knew before starting [Topic]"
      - "Hidden [Topic] gems you need to see"
      
      IMPORTANT: 
      1. Return the suggestions in ENGLISH.
      2. Return a JSON list of 6 short, punchy, creative topic strings.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["suggestions"],
        },
      },
    });

    const parsed = JSON.parse(response.text);
    return parsed.suggestions;
  } catch (error) {
    console.warn("Error suggesting topics from history:", error);
    return [
      "Weekend Adventure Vlog",
      "Hidden Cafe Gems",
      "My Daily Essentials",
      "Streetwear Vibe Check",
      "Self-care Sunday Routine",
      "Creative Desk Setup"
    ];
  }
}

export interface Suggestions {
  audiences: string[];
  aesthetics: string[];
}

export async function suggestTags(topic: string): Promise<Suggestions> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Suggest 10 specific target audiences and 6 visual aesthetics for a RedNote post about "${topic}". 
      Audiences should be short phrases (2-4 words) targeting RedNote demographics.
      Aesthetics should be trending RedNote styles (e.g., "Minimalist White", "Urban Street").
      IMPORTANT: Return everything in ENGLISH.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            audiences: { type: Type.ARRAY, items: { type: Type.STRING } },
            aesthetics: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ["audiences", "aesthetics"],
        },
      },
    });

    return JSON.parse(response.text);
  } catch (error) {
    console.warn("Error suggesting tags:", error);
    const lowerTopic = topic.toLowerCase();
    
    // Better context-aware fallback
    if (lowerTopic.includes("food") || lowerTopic.includes("cafe") || lowerTopic.includes("coffee") || lowerTopic.includes("restaurant")) {
      return {
        audiences: ["Coffee Enthusiasts", "Foodies", "Cafe Hoppers", "Weekend Brunchers", "Urban Explorers", "Aesthetic Lovers", "Students", "Freelancers"],
        aesthetics: ["Minimalist White", "Vintage Film", "Cozy Home", "Urban Street"]
      };
    }
    
    if (lowerTopic.includes("travel") || lowerTopic.includes("vlog") || lowerTopic.includes("trip") || lowerTopic.includes("hotel")) {
      return {
        audiences: ["Solo Travelers", "Digital Nomads", "Luxury Travelers", "Adventure Seekers", "Backpackers", "Photography Fans", "Culture Seekers", "Nature Lovers"],
        aesthetics: ["Film Photography", "Cinematic Vlog", "Earth Tones", "Moody Travel"]
      };
    }

    if (lowerTopic.includes("fashion") || lowerTopic.includes("outfit") || lowerTopic.includes("ootd") || lowerTopic.includes("style")) {
      return {
        audiences: ["Fashionistas", "OOTD Lovers", "Trend Seekers", "Gen Z Stylists", "Minimalist Lovers", "Shopping Addicts", "Students", "Creative Pros"],
        aesthetics: ["Urban Streetwear", "Clean Girl", "Old Money", "Y2K Aesthetic"]
      };
    }

    return {
      audiences: [
        "Gen Z Trendsetters", "Urban Professionals", "Creative Freelancers", 
        "Digital Nomads", "Minimalist Lovers", "Photography Fans", 
        "Tech Enthusiasts", "Lifestyle Bloggers"
      ],
      aesthetics: [
        "Minimalist White", "VSCO Moody", "Urban Street", "Vintage Film", 
        "Soft Fairycore", "Technical Techwear"
      ]
    };
  }
}

export function stripMarkdown(text: string): string {
  if (!text) return "";
  return text
    // Replace level 1-6 heading markers at start of a line (e.g. # Heading or ### Heading)
    .replace(/^\s*#+\s*(.*?)$/gm, '$1')
    // Remove bold syntax **bold**
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    // Remove bold syntax __bold__
    .replace(/__([^_]+)__/g, '$1')
    // Remove italic syntax *italic*
    .replace(/\*([^*]+)\*/g, '$1')
    // Remove italic syntax _italic_
    .replace(/_([^_]+)_/g, '$1')
    // Remove inline code formatting `code`
    .replace(/`([^`]+)`/g, '$1')
    // Replace markdown unordered list items like: * Item or - Item with standard bullet point
    .replace(/^\s*[-\*+]\s+/gm, '• ')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n');
}
