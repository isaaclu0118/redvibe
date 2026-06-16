/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, type ReactNode, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BarChart3, Edit3, Image as ImageIcon, Send, RefreshCcw, Heart, Share2, Bookmark, Users, LogIn, LogOut, History, Zap, Target, LayoutDashboard, BrainCircuit, MapPin, Settings as SettingsIcon, X, Notebook, MessageCircle, Sparkles, Feather } from "lucide-react";
import { generateContent, Platform, rateContent, suggestRefinements, suggestTags, suggestTopicsFromHistory, RedNotePost, RedNoteRating, setGeminiApiKey, translateToPlatformStyle, recommendNextSteps, ContentStrategy, refineInspiration, generateContentMatrix, MatrixItem } from "./lib/gemini";
import { cn } from "./lib/utils";
import { supabase, type AppUser as User, getUserAvatar, handleSupabaseError, OperationType } from "./lib/supabase";
import { Globe, ArrowRight, Trash2, Plus, Eye, EyeOff, Save, Key, Calendar, LayoutGrid, CheckCircle2 } from "lucide-react";

const PERSONA_ROLES = [
  { name: "Personal", description: "Vlogger, Creator, Individual Voice" },
  { name: "Official", description: "Studio, Brand, Corporate Voice" },
  { name: "Gen Z", description: "Casual, High Energy, Slang" },
  { name: "Expert", description: "Educational, Structured, Professional" }
];

const PLATFORM_CONFIG = {
  xhs: {
    name: "RedNote",
    icon: Notebook,
    accent: "bg-[#FF2442]",
    text: "text-[#FF2442]",
    border: "border-[#FF2442]",
    focusBorder: "focus:border-[#FF2442]",
    shadow: "shadow-[#FF2442]/20",
    light: "bg-[#FFF1F2]",
    lightText: "text-[#FF2442]/60",
    lightBg: "bg-[#FF2442]/5",
    ring: "ring-[#FF2442]/10",
    char: "R"
  },
  wechat: {
    name: "ArticlePro",
    icon: MessageCircle,
    accent: "bg-[#07C160]",
    text: "text-[#07C160]",
    border: "border-[#07C160]",
    focusBorder: "focus:border-[#07C160]",
    shadow: "shadow-[#07C160]/20",
    light: "bg-[#F0FFF4]",
    lightText: "text-[#07C160]/60",
    lightBg: "bg-[#07C160]/5",
    ring: "ring-[#07C160]/10",
    char: "W"
  }
};

function formatDate(value: unknown) {
  if (!value) return "Just now";
  const date = value instanceof Date ? value : new Date(String(value));
  return Number.isNaN(date.getTime()) ? "Just now" : date.toLocaleDateString();
}

function mapFavoriteRow(row: any) {
  const { created_at, english_title, english_body, image_prompts, user_id, ...favorite } = row;
  return {
    ...favorite,
    englishTitle: english_title,
    englishBody: english_body,
    imagePrompts: image_prompts || [],
    createdAt: created_at,
  };
}

export default function App() {
  const [topic, setTopic] = useState("");
  const [location, setLocation] = useState("");
  const [mood, setMood] = useState("");
  const [ageFilter, setAgeFilter] = useState<string[]>(["18-24", "25-34"]);
  const [audience, setAudience] = useState("");
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [suggestedAudiences, setSuggestedAudiences] = useState<string[]>([]);
  const [isSuggestingAudiences, setIsSuggestingAudiences] = useState(false);
  const [suggestedAesthetics, setSuggestedAesthetics] = useState<string[]>([]);
  const [isSuggestingAesthetics, setIsSuggestingAesthetics] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Platform Logic
  const [platform, setPlatform] = useState<Platform>("xhs");
  const config = PLATFORM_CONFIG[platform];

  const [platformPosts, setPlatformPosts] = useState<Record<Platform, RedNotePost | null>>({ xhs: null, wechat: null });
  const [platformRatings, setPlatformRatings] = useState<Record<Platform, RedNoteRating | null>>({ xhs: null, wechat: null });
  const [platformImages, setPlatformImages] = useState<Record<Platform, string | null>>({ xhs: null, wechat: null });
  const [platformRefinements, setPlatformRefinements] = useState<Record<Platform, string[]>>({ xhs: [], wechat: [] });
  
  const result = platformPosts[platform];
  const rating = platformRatings[platform];
  const generatedImage = platformImages[platform];
  const suggestedRefinements = platformRefinements[platform];

  const [user, setUser] = useState<User | null>(null);
  const userAvatar = getUserAvatar(user);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [currentPromptIndex, setCurrentPromptIndex] = useState(0);
  const [topicHistory, setTopicHistory] = useState<string[]>([]);
  const [topicSuggestions, setTopicSuggestions] = useState<string[]>([]);
  const [isSuggestingTopics, setIsSuggestingTopics] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [refinement, setRefinement] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [targetCharacters, setTargetCharacters] = useState(platform === 'wechat' ? 800 : 300);
  const [apiKey, setApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('gemini_api_key');
      return saved || process.env.GEMINI_API_KEY || "";
    }
    return process.env.GEMINI_API_KEY || "";
  });
  const [showApiKey, setShowApiKey] = useState(false);
  const [imageApiKey, setImageApiKey] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('image_api_key') || "";
    }
    return "";
  });
  const [showImageApiKey, setShowImageApiKey] = useState(false);
  
  const isSystemDefault = apiKey === process.env.GEMINI_API_KEY || !apiKey;
  
  useEffect(() => {
    setGeminiApiKey(apiKey);
  }, [apiKey]);
  
  const [showFavsOnly, setShowFavsOnly] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [showFavsModal, setShowFavsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showInspirationModal, setShowInspirationModal] = useState(false);
  const [showMatrixModal, setShowMatrixModal] = useState(false);
  const [matrixItems, setMatrixItems] = useState<MatrixItem[]>([]);
  const [isGeneratingMatrix, setIsGeneratingMatrix] = useState(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<Record<string, RedNotePost>>({});

  const [contentStrategy, setContentStrategy] = useState<ContentStrategy | null>(null);
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"identity" | "engine">("identity");
  const [isSyncing, setIsSyncing] = useState(false);

  // Monitor auth state
  const [favorites, setFavorites] = useState<{ id: string; [key: string]: any }[]>([]);
  const [inspirations, setInspirations] = useState<{ id: string; text: string; createdAt: any }[]>([]);
  const [activeTab, setActiveTab] = useState<"recent" | "favs">("recent");
  const [isSavingFav, setIsSavingFav] = useState(false);
  
  // Persona Logic
  const [personas, setPersonas] = useState<{id: string, role: string, detail: string, isDefault: boolean}[]>([]);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [persona, setPersona] = useState("");
  const [personaRole, setPersonaRole] = useState(PERSONA_ROLES[0].name);

  // Inspiration states
  const [rawNote, setRawNote] = useState("");
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isRefiningInspiration, setIsRefiningInspiration] = useState(false);

  // Sync English to Chinese logic
  useEffect(() => {
    if (!result) return;
    
    const timer = setTimeout(() => {
      // Only sync if there's actual content to sync
      if (result.englishBody && !isGenerating) {
        syncTranslation();
      }
    }, 1500); // 1.5s debounce

    return () => clearTimeout(timer);
  }, [result?.englishBody, result?.englishTitle]);

  const syncTranslation = async () => {
    if (!result || isGenerating) return;
    setIsSyncing(true);
    try {
      const translated = await translateToPlatformStyle(
        platform, 
        result.englishTitle,
        result.englishBody, 
        persona
      );
      
      setPlatformPosts(prev => ({
        ...prev,
        [platform]: {
          ...prev[platform]!,
          title: translated.title,
          body: translated.body
        }
      }));
    } catch (error) {
      console.error("Translation sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const updateEnglishContent = (field: 'englishTitle' | 'englishBody', value: string) => {
    if (!result) return;
    setPlatformPosts(prev => ({
      ...prev,
      [platform]: {
        ...prev[platform]!,
        [field]: value
      }
    }));
  };

  const handleGetStrategy = async () => {
    if (!user) return;
    setIsGeneratingStrategy(true);
    setShowStrategyModal(true);
    try {
      const historyTitles = favorites.map(f => f.title || f.topic || "Untitled Post");
      const strategy = await recommendNextSteps(historyTitles, persona);
      setContentStrategy(strategy);
    } catch (error) {
      console.error("Strategy generation failed:", error);
    } finally {
      setIsGeneratingStrategy(false);
    }
  };

  const handleGenerateMatrix = async () => {
    if (!user) return;
    setIsGeneratingMatrix(true);
    setShowMatrixModal(true);
    try {
      const historyTitles = favorites.map(f => f.title || f.topic || "Untitled Post");
      const fullPersona = `${personaRole}: ${persona}`;
      const matrix = await generateContentMatrix(historyTitles, persona ? fullPersona : undefined);
      setMatrixItems(matrix);
    } catch (error) {
      console.error("Matrix generation failed:", error);
    } finally {
      setIsGeneratingMatrix(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (matrixItems.length === 0) return;
    setIsBatchGenerating(true);
    setBatchProgress(0);
    const results: Record<string, RedNotePost> = {};
    
    try {
      for (let i = 0; i < matrixItems.length; i++) {
        const item = matrixItems[i];
        const fullPersona = `${personaRole}: ${persona}`;
        const post = await generateContent(
          platform, 
          item.title, 
          item.mood, 
          item.audience, 
          "", 
          location, 
          persona ? fullPersona : undefined,
          undefined,
          targetCharacters
        );
        results[item.id] = post;
        setBatchProgress(Math.round(((i + 1) / matrixItems.length) * 100));
        setBatchResults(prev => ({ ...prev, [item.id]: post }));
      }
    } catch (error) {
      console.error("Batch generation failed:", error);
    } finally {
      setIsBatchGenerating(false);
    }
  };
  
  // Unlock Logic
  const [isUnlocked, setIsUnlocked] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('rednote_unlocked') === 'true';
    }
    return false;
  });
  const [unlockCode, setUnlockCode] = useState("");
  const [unlockError, setUnlockError] = useState(false);

  useEffect(() => {
    if (unlockCode.toUpperCase() === 'REDNOTEIN2026') {
      setIsUnlocked(true);
      localStorage.setItem('rednote_unlocked', 'true');
    } else if (unlockCode.length >= 13) {
      setUnlockError(true);
      setTimeout(() => setUnlockError(false), 2000);
    }
  }, [unlockCode]);
  
  // Debounced regeneration on character count change
  useEffect(() => {
    if (!platformPosts[platform] || isGenerating) return;
    const timer = setTimeout(() => {
       handleGenerate();
    }, 2000);
    return () => clearTimeout(timer);
  }, [targetCharacters]);

  // Monitor auth state
  useEffect(() => {
    const loadUserData = (uid: string) => {
      fetchHistory(uid);
      fetchFavorites(uid);
      fetchInspirations(uid);
    };

    const bootstrapAuth = async () => {
      const url = new URL(window.location.href);
      const oauthCode = url.searchParams.get("code");

      if (oauthCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(oauthCode);
        if (error) {
          console.error("OAuth session exchange failed", error);
        } else {
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const { data } = await supabase.auth.getSession();
      const currentUser = data.session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.id);
      }
    };

    bootstrapAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        loadUserData(currentUser.id);
      } else {
        setTopicHistory([]);
        setTopicSuggestions([]);
        setFavorites([]);
        setInspirations([]);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const fetchFavorites = async (uid: string) => {
    const path = `favorites:${uid}`;
    try {
      const { data, error } = await supabase
        .from("favorites")
        .select("*")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setFavorites((data || []).map(mapFavoriteRow));
    } catch (error) {
      handleSupabaseError(error, OperationType.GET, path);
    }
  };

  const fetchInspirations = async (uid: string) => {
    const path = `inspirations:${uid}`;
    try {
      const { data, error } = await supabase
        .from("inspirations")
        .select("id,text,created_at")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setInspirations((data || []).map(({ created_at, ...item }) => ({
        ...item,
        createdAt: created_at,
      })));
    } catch (error) {
       handleSupabaseError(error, OperationType.GET, path);
    }
  };

  const saveInspiration = async () => {
    if (!user || !rawNote.trim()) return;
    setIsSavingNote(true);
    const path = `inspirations:${user.id}`;
    try {
      const { error } = await supabase.from("inspirations").insert({
        user_id: user.id,
        text: rawNote,
      });
      if (error) throw error;
      setRawNote("");
      fetchInspirations(user.id);
    } catch (error) {
      handleSupabaseError(error, OperationType.CREATE, path);
    } finally {
      setIsSavingNote(false);
    }
  };

  const deleteInspiration = async (id: string) => {
    if (!user) return;
    const path = `inspirations:${id}`;
    try {
      const { error } = await supabase
        .from("inspirations")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      fetchInspirations(user.id);
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  };

  const transformInspiration = async (noteText: string) => {
    setIsRefiningInspiration(true);
    setShowInspirationModal(false);
    try {
      const refined = await refineInspiration(noteText, persona);
      setTopic(refined.suggestedTopic);
      handleGenerate(undefined, undefined, refined.clarifiedConcept);
    } catch (error) {
      console.error("Refinement failed:", error);
    } finally {
      setIsRefiningInspiration(false);
    }
  };

  const toggleFavorite = async () => {
    if (!user || !result || isSavingFav) return;
    setIsSavingFav(true);

    const isFav = favorites.some(f => f.title === result.title && f.topic === topic);
    const path = `favorites:${user.id}`;

    try {
      if (isFav) {
        const favToRemove = favorites.find(f => f.title === result.title && f.topic === topic);
        if (favToRemove) {
          const { error } = await supabase
            .from("favorites")
            .delete()
            .eq("id", favToRemove.id)
            .eq("user_id", user.id);
          if (error) throw error;
          setFavorites(prev => prev.filter(f => f.id !== favToRemove.id));
        }
      } else {
        const newDoc = {
          ...result,
          platform,
          topic,
        };
        const { data, error } = await supabase
          .from("favorites")
          .insert({
            user_id: user.id,
            platform: newDoc.platform,
            topic: newDoc.topic,
            title: newDoc.title,
            body: newDoc.body,
            english_title: newDoc.englishTitle,
            english_body: newDoc.englishBody,
            tags: newDoc.tags || [],
            image_prompts: newDoc.imagePrompts || [],
            location: newDoc.location || null,
          })
          .select("*")
          .single();
        if (error) throw error;
        setFavorites(prev => [mapFavoriteRow(data), ...prev]);
      }
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    } finally {
      setIsSavingFav(false);
    }
  };

  const removeFavorite = async (id: string) => {
    if (!user) return;
    const path = `favorites:${id}`;
    try {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
      setFavorites(prev => prev.filter(f => f.id !== id));
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  };

  const fetchHistory = async (uid: string) => {
    const path = `profiles:${uid}`;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("topic_history,personas")
        .eq("id", uid)
        .maybeSingle();
      if (error) throw error;

      if (data) {
        const history = data.topic_history || [];
        setTopicHistory(history);
        if (history.length > 0) {
          generateTopicSuggestions(history);
        }

        const fetchedPersonas = data.personas || [];
        setPersonas(fetchedPersonas);
        if (fetchedPersonas.length > 0) {
          const activeP = fetchedPersonas.find((p: any) => p.isDefault) || fetchedPersonas[0];
          setActivePersonaId(activeP.id);
          setPersona(activeP.detail);
          setPersonaRole(activeP.role);
        }
      }
    } catch (error) {
      handleSupabaseError(error, OperationType.GET, path);
    }
  };

  const handleSavePersona = async () => {
    if (!user) return;
    const path = `profiles:${user.id}`;
    
    const newPersona = {
      id: activePersonaId || Math.random().toString(36).substring(2, 11),
      role: personaRole,
      detail: persona,
      isDefault: true
    };

    let updatedPersonas = [...personas];
    const index = updatedPersonas.findIndex(p => p.id === newPersona.id);
    
    if (index >= 0) {
      updatedPersonas[index] = newPersona;
    } else {
      updatedPersonas.push(newPersona);
    }

    updatedPersonas = updatedPersonas.map(p => ({
      ...p,
      isDefault: p.id === newPersona.id
    }));

    setPersonas(updatedPersonas);
    setActivePersonaId(newPersona.id);

    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        personas: updatedPersonas,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  };

  const deletePersona = async (id: string) => {
    if (!user) return;
    const updatedPersonas = personas.filter(p => p.id !== id);
    setPersonas(updatedPersonas);
    if (activePersonaId === id) {
      setActivePersonaId(null);
      setPersona("");
      setPersonaRole(PERSONA_ROLES[0].name);
    }
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        personas: updatedPersonas,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, `profiles:${user.id}`);
    }
  };

  const saveToHistory = async (newTopic: string) => {
    if (!user || !newTopic) return;
    const path = `profiles:${user.id}`;
    try {
      const updatedHistory = Array.from(new Set([newTopic, ...topicHistory])).slice(0, 5);
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        topic_history: updatedHistory,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;

      setTopicHistory(updatedHistory);
      generateTopicSuggestions(updatedHistory);
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  };

  const generateTopicSuggestions = async (history: string[]) => {
    if (history.length === 0) return;
    setIsSuggestingTopics(true);
    try {
      const suggestions = await suggestTopicsFromHistory(history);
      setTopicSuggestions(suggestions);
    } catch (error) {
      console.error("Error suggesting topics:", error);
    } finally {
      setIsSuggestingTopics(false);
    }
  };

  const handleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleReset = () => {
    setTopic("");
    setLocation("");
    setMood("");
    setAudience("");
    setSelectedAudiences([]);
    setSuggestedAudiences([]);
    setSuggestedAesthetics([]);
    setRefinement("");
    setQuotaError(null);
    setTargetCharacters(platform === 'wechat' ? 800 : 300);
    setPlatformPosts(prev => ({ ...prev, [platform]: null }));
    setPlatformRatings(prev => ({ ...prev, [platform]: null }));
    setPlatformImages(prev => ({ ...prev, [platform]: null }));
    setPlatformRefinements(prev => ({ ...prev, [platform]: [] }));
  };

  const handleGenerateImage = async () => {
    if (!result || result.imagePrompts.length === 0) return;
    
    setIsGeneratingImage(true);
    // Simulate a bit of loading for the "AI" feel
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const prompt = result.imagePrompts[currentPromptIndex];
    // Keep characters that are safe for URL encoding, including Chinese characters
    const cleanPrompt = prompt.replace(/[^\u4e00-\u9fa5\w\s,]/gi, '').substring(0, 400);
    const encodedPrompt = encodeURIComponent(cleanPrompt + ", RedNote style, aesthetic, high resolution");
    
    const seed = Math.floor(Math.random() * 1000000);
    // Use the 'nanobanana' model as specifically requested by the user
    // Adding nologo=true and ensuring the model param is correctly appended
    const imageUrl = `https://pollinations.ai/p/${encodedPrompt}?width=1080&height=1440&seed=${seed}&model=nanobanana&nologo=true`;
    
    setPlatformImages(prev => ({ ...prev, [platform]: imageUrl }));
    setIsGeneratingImage(false);
    
    // Cycle to next prompt for next time
    setCurrentPromptIndex((prev) => (prev + 1) % result.imagePrompts.length);
  };

  // AI Tag Matching based on topic
  useEffect(() => {
    if (topic.trim().length <= 5) {
      setSuggestedAudiences([]);
      setSuggestedAesthetics([]);
      setAudience("");
      setSelectedAudiences([]);
      setMood("");
      return;
    }

    const timer = setTimeout(async () => {
      setIsSuggestingAudiences(true);
      setIsSuggestingAesthetics(true);
      try {
        const { audiences, aesthetics } = await suggestTags(topic);
        setSuggestedAudiences(audiences);
        setSuggestedAesthetics(aesthetics);
        
        // Auto-select first two if nothing selected
        if (selectedAudiences.length === 0 && audiences.length > 0) {
          const topTwo = audiences.slice(0, 2);
          setSelectedAudiences(topTwo);
          setAudience(topTwo.join(", "));
        }
        if (!mood && aesthetics.length > 0) {
          setMood(aesthetics[0]);
        }
      } catch (error) {
        console.error("Tags suggestion failed", error);
      } finally {
        setIsSuggestingAudiences(false);
        setIsSuggestingAesthetics(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [topic]);

  const toggleAudience = (s: string) => {
    setSelectedAudiences(prev => {
      const isSelected = prev.includes(s);
      const next = isSelected ? prev.filter(a => a !== s) : [...prev, s];
      setAudience(next.join(", "));
      return next;
    });
  };

  const toggleAgeFilter = (age: string) => {
    setAgeFilter(prev => {
      const isSelected = prev.includes(age);
      if (isSelected) {
        if (prev.length === 1) return prev; // Keep at least one selected
        return prev.filter(a => a !== age);
      }
      return [...prev, age];
    });
  };

  const handleRefreshAudiences = async () => {
    if (topic.trim().length <= 5) return;
    setIsSuggestingAudiences(true);
    setIsSuggestingAesthetics(true);
    try {
      const { audiences, aesthetics } = await suggestTags(topic);
      setSuggestedAudiences(audiences);
      setSuggestedAesthetics(aesthetics);
      
      // Auto-select first two if nothing selected or let user decide
      if (audiences.length > 0) {
        const topTwo = audiences.slice(0, 2);
        setSelectedAudiences(topTwo);
        setAudience(topTwo.join(", "));
      }
      if (aesthetics.length > 0) {
        setMood(aesthetics[0]);
      }
    } catch (error) {
      console.error("Tags suggestion failed", error);
    } finally {
      setIsSuggestingAudiences(false);
      setIsSuggestingAesthetics(false);
    }
  };

  const handleGenerate = async (refinePrompt?: string, chars?: number, inspirationContext?: string) => {
    if (!topic && !inspirationContext) return;
    setIsGenerating(true);
    setPlatformPosts(prev => ({ ...prev, [platform]: null }));
    setPlatformRatings(prev => ({ ...prev, [platform]: null }));
    setQuotaError(null);
    setPlatformImages(prev => ({ ...prev, [platform]: null }));
    setCurrentPromptIndex(0);
    try {
      const fullPersona = `${personaRole}: ${persona}`;
      const post = await generateContent(platform, topic, mood, selectedAudiences.join(", "), ageFilter.join(", "), location, persona ? fullPersona : undefined, refinePrompt, chars || targetCharacters, inspirationContext);
      
      setPlatformPosts(prev => ({ ...prev, [platform]: post }));
      saveToHistory(topic);
      
      // Parallel score and refinement suggestions
      const [score, refinements] = await Promise.all([
        rateContent(platform, post, topic),
        suggestRefinements(platform, post)
      ]);
      
      setPlatformRatings(prev => ({ ...prev, [platform]: score }));
      setPlatformRefinements(prev => ({ ...prev, [platform]: refinements }));
      setRefinement(""); // Clear manual input
    } catch (error: any) {
      console.error("Generation failed", error);
      if (error?.message?.includes("429") || error?.message?.includes("quota") || error?.message?.includes("RESOURCE_EXHAUSTED")) {
        setQuotaError("Gemini API quota exceeded. Please try again in a few minutes.");
      } else {
        setQuotaError("Generation failed. Please check your connection and try again.");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className={cn("min-h-screen bg-[#F9F9F9] font-sans transition-all duration-500", platform === 'xhs' ? 'selection:bg-[#FF2442]/20' : 'selection:bg-[#07C160]/20')}>
      {/* Dense Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 px-4 md:px-6 py-3">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shadow-lg transition-all duration-500", config.accent, config.shadow)}>
                <span className="text-white font-bold text-base leading-none" style={{ fontFamily: "ui-rounded, 'Hiragino Maru Gothic ProN', 'Quicksand', sans-serif" }}>{config.char}</span>
              </div>
              <div className="hidden sm:block">
                <span className="font-display font-bold text-lg tracking-tight text-gray-900">{config.name}</span>
                <span className={cn("font-medium text-xs ml-1.5 px-1.5 py-0.5 rounded transition-colors duration-500", config.text, config.light)}>Pro Engine</span>
              </div>
            </div>

            {/* Platform Switch in Top Bar */}
            <div className="flex bg-gray-100 p-1 rounded-xl gap-1 scale-90 origin-left">
              <button 
                onClick={() => setPlatform("xhs")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                  platform === "xhs" 
                  ? "bg-white text-[#FF2442] shadow-sm" 
                  : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Notebook size={12} />
                RedNote
              </button>
              <button 
                onClick={() => setPlatform("wechat")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
                  platform === "wechat" 
                  ? "bg-white text-[#07C160] shadow-sm" 
                  : "text-gray-500 hover:text-gray-700"
                )}
              >
                <MessageCircle size={12} />
                WeChat
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full border border-green-100">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            </div>

            {user && (
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => setShowInspirationModal(true)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider",
                    inspirations.length > 0 
                    ? "bg-amber-50 text-amber-600" 
                    : "bg-gray-50 text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Feather size={14} className={inspirations.length > 0 ? "text-amber-500" : ""} />
                  Inspirations <span className="opacity-40">{inspirations.length}</span>
                </button>
                <button 
                  onClick={() => setShowFavsModal(true)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all text-[10px] font-bold uppercase tracking-wider",
                    favorites.length > 0 
                    ? cn(config.lightBg, config.text) 
                    : "bg-gray-50 text-gray-400 hover:text-gray-600"
                  )}
                >
                  <Heart size={14} className={favorites.length > 0 ? "fill-current" : ""} />
                  Saved <span className="opacity-40">{favorites.length}</span>
                </button>
                <button 
                  onClick={handleGenerateMatrix}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-600 group relative"
                  title="Content Matrix"
                >
                  <LayoutGrid size={18} className={cn("transition-all", isGeneratingMatrix ? "animate-pulse text-indigo-500" : "group-hover:text-indigo-500")} />
                  {isGeneratingMatrix && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                    </span>
                  )}
                </button>
                <button 
                  onClick={handleGetStrategy}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-600 group relative"
                  title="Post Strategy"
                >
                  <Sparkles size={18} className={cn("transition-all", isGeneratingStrategy ? "animate-pulse text-amber-500" : "group-hover:text-amber-500")} />
                  {isGeneratingStrategy && (
                    <span className="absolute -top-1 -right-1 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400 hover:text-gray-600"
                >
                  <SettingsIcon size={18} />
                </button>
              </div>
            )}
            
            {user ? (
              <div className="flex items-center gap-3 pl-6 border-l border-gray-100">
                {userAvatar && (
                  <img src={userAvatar} alt="" className={cn("w-8 h-8 rounded-full ring-2 transition-all duration-500", platform === 'xhs' ? 'ring-[#FF2442]/10' : 'ring-[#07C160]/10')} />
                )}
                <button onClick={handleLogout} className={cn("p-2 text-gray-400 transition-colors duration-500", platform === 'xhs' ? 'hover:text-[#FF2442]' : 'hover:text-[#07C160]')}>
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <button 
                onClick={handleLogin}
                className="flex items-center gap-2 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-gray-800 transition-all active:scale-95"
              >
                <LogIn size={16} />
                Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      <AnimatePresence>
        {!isUnlocked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/90 backdrop-blur-xl flex flex-col items-center justify-center p-6"
          >
            <div className="max-w-md w-full space-y-8 text-center">
              <div className="flex justify-center">
                <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-500", config.accent, platform === 'xhs' ? 'shadow-[#FF2442]/40' : 'shadow-[#07C160]/40')}>
                  <span className="text-white font-bold text-3xl leading-none" style={{ fontFamily: "ui-rounded, 'Hiragino Maru Gothic ProN', 'Quicksand', sans-serif" }}>{config.char}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <h2 className="text-3xl font-display font-black text-gray-900 tracking-tight">Access {config.name}</h2>
                <p className="text-gray-500 text-sm font-medium">This is an inclusive community app. Enter your invitation code to access all creative features.</p>
              </div>

              <div className="relative group">
                <input
                  type="text"
                  value={unlockCode}
                  onChange={(e) => setUnlockCode(e.target.value)}
                  placeholder="Enter Access Code"
                  className={cn(
                    "w-full bg-gray-50 border-2 rounded-2xl px-6 py-4 text-center text-lg font-bold tracking-widest outline-none transition-all placeholder:text-gray-300",
                    unlockError ? "border-red-400 animate-shake" : cn("border-gray-100 focus:bg-white", config.focusBorder)
                  )}
                />
                {unlockError && (
                  <p className="absolute -bottom-6 left-0 right-0 text-[10px] font-bold text-red-500 uppercase tracking-widest">Invalid Invitation Code</p>
                )}
              </div>

              <div className="pt-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Hint: Universal Alpha Key Required</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="max-w-[1600px] mx-auto p-4 md:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Input & Controls (Column 1-4) */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-24">
            <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 overflow-hidden relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <config.icon size={12} className={config.text} />
                    Content Laboratory
                  </h2>
                  {(topic || result) && (
                    <button 
                      onClick={handleReset}
                      className="text-[10px] font-bold text-gray-300 hover:text-red-500 transition-colors flex items-center gap-1 uppercase tracking-widest px-2 py-1 rounded-lg hover:bg-red-50"
                    >
                      <Trash2 size={10} />
                      Reset
                    </button>
                  )}
                </div>

                <textarea
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={platform === 'xhs' ? "What's your viral topic today? (e.g. Minimalist Tokyo Coffee Tour)" : "Enter your article topic (e.g. The Future of AI in Design)"}
                  className={cn("w-full text-base md:text-xl font-display font-bold placeholder:text-gray-200 outline-none border-b border-gray-100 transition-all py-2 resize-none h-24 md:h-28 bg-transparent", config.focusBorder)}
                />

                {/* Compact Topics */}
                <div className="space-y-3 pt-2">
                   {topicHistory.length > 0 && (
                     <div className="flex flex-wrap gap-1.5">
                       {topicHistory.slice(0, 3).map((t, i) => (
                         <button 
                          key={i} 
                          onClick={() => setTopic(t)}
                          className="px-2.5 py-1 bg-gray-50 text-gray-500 rounded-lg text-[10px] font-medium hover:bg-gray-100 transition-colors truncate max-w-[120px]"
                         >
                           {t}
                         </button>
                       ))}
                     </div>
                   )}
                </div>
              </div>

              {/* Simplified Selection Panel */}
              <div className="mt-8 space-y-6">

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <MapPin size={12} className={config.text} />
                      Location Info <span className="text-[8px] font-medium opacity-60">(Optional)</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Add a location (e.g. Ginza, Tokyo)"
                    className={cn("w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2.5 text-xs font-medium outline-none transition-all", config.focusBorder)}
                  />
                </div>


                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Users size={12} className={config.text} />
                      Active Voice
                    </label>
                    <button 
                      onClick={() => setShowSettingsModal(true)}
                      className="text-[8px] font-bold text-blue-500 hover:text-blue-600 transition-all uppercase tracking-widest"
                    >
                      Manage
                    </button>
                  </div>
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                      <button
                        onClick={() => {
                          setActivePersonaId(null);
                          setPersona("");
                          setPersonaRole(PERSONA_ROLES[0].name);
                        }}
                        className={cn(
                          "flex-shrink-0 px-3 py-2 rounded-xl text-[9px] font-bold transition-all border",
                          activePersonaId === null
                            ? cn("text-white", config.accent, config.border)
                            : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                        )}
                      >
                        Default
                      </button>
                      {(personas || []).map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActivePersonaId(p.id);
                            setPersona(p.detail);
                            setPersonaRole(p.role);
                          }}
                          className={cn(
                            "flex-shrink-0 px-3 py-2 rounded-xl text-[9px] font-bold transition-all border max-w-[120px] truncate",
                            activePersonaId === p.id 
                              ? cn("text-white", config.accent, config.border)
                              : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                          )}
                          title={p.detail}
                        >
                          {p.detail || p.role}
                        </button>
                      ))}
                    </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Target size={12} className={config.text} />
                      Age Group
                    </label>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {['Kids', '18-24', '25-34', '35-44', '45+'].map((age) => (
                      <button
                        key={age}
                        onClick={() => toggleAgeFilter(age)}
                        className={cn(
                          "py-2 px-1 rounded-lg text-[9px] font-bold transition-all border text-center",
                          ageFilter.includes(age)
                            ? cn("text-white", config.accent, config.border)
                            : "bg-white border-gray-100 text-gray-500 hover:border-gray-200"
                        )}
                      >
                        {age}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BrainCircuit size={12} className={config.text} />
                      Audience Match <span className="text-[8px] font-medium opacity-60 lowercase tracking-normal">(Select multiple for best results)</span>
                    </label>
                    <button 
                      onClick={handleRefreshAudiences}
                      disabled={isSuggestingAudiences || topic.trim().length <= 5}
                      className={cn(
                        "p-1 rounded-md transition-all",
                        isSuggestingAudiences ? "animate-spin cursor-not-allowed" : "hover:bg-gray-100 active:scale-95",
                        config.text
                      )}
                      title="Refresh suggestions"
                    >
                      <RefreshCcw size={12} />
                    </button>
                  </div>
                  
                  {suggestedAudiences.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 py-1">
                      {suggestedAudiences.map((a, i) => (
                        <button 
                          key={i}
                          onClick={() => toggleAudience(a)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all border",
                            selectedAudiences.includes(a) 
                              ? cn("text-white", config.accent, config.border)
                              : "bg-gray-50 text-gray-500 border-gray-100 hover:bg-gray-100"
                          )}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 bg-gray-50/50 border border-dashed border-gray-100 rounded-2xl text-center">
                      <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">Awaiting Analysis</p>
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex flex-col">
                      <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <Target size={12} className={config.text} />
                        Target Length
                      </label>
                      <span className="text-[8px] font-medium text-gray-300 uppercase tracking-widest mt-0.5 ml-5">
                        Est. {Math.ceil(targetCharacters / 400)} min read
                      </span>
                    </div>
                    <span className={cn("text-[10px] font-black tabular-nums", config.text)}>{targetCharacters} chars</span>
                  </div>
                  <div className="px-1 pt-1">
                    <input 
                      type="range"
                      min={platform === 'wechat' ? 400 : 100}
                      max={platform === 'wechat' ? 3000 : 1000}
                      step={platform === 'wechat' ? 100 : 50}
                      value={targetCharacters}
                      onChange={(e) => setTargetCharacters(parseInt(e.target.value))}
                      className={cn(
                        "w-full h-1.5 rounded-lg appearance-none cursor-pointer",
                        "relative z-10",
                        "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-gray-100 [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:active:scale-95",
                        "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_2px_8px_rgba(0,0,0,0.15)] [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-gray-100 [&::-moz-range-thumb]:border-none",
                        config.lightBg
                      )}
                      style={{
                        background: `linear-gradient(to right, ${platform === 'xhs' ? '#FF2442' : '#07C160'} 0%, ${platform === 'xhs' ? '#FF2442' : '#07C160'} ${((targetCharacters - (platform === 'wechat' ? 400 : 100)) / ((platform === 'wechat' ? 3000 : 1000) - (platform === 'wechat' ? 400 : 100))) * 100}%, #F3F4F6 ${((targetCharacters - (platform === 'wechat' ? 400 : 100)) / ((platform === 'wechat' ? 3000 : 1000) - (platform === 'wechat' ? 400 : 100))) * 100}%, #F3F4F6 100%)`
                      }}
                    />
                    <div className="flex justify-between mt-2 px-0.5">
                      <span className="text-[7px] font-bold text-gray-300 uppercase tracking-widest leading-none">{platform === 'wechat' ? 'Succinct' : 'Short'}</span>
                      <span className="text-[7px] font-bold text-gray-300 uppercase tracking-widest leading-none">{platform === 'wechat' ? 'Deep-Dive' : 'Explanatory'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {quotaError && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-xs font-bold text-red-600 flex items-center gap-3"
                >
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse shrink-0" />
                  {quotaError}
                </motion.div>
              )}

               <button 
                onClick={handleGenerate}
                disabled={isGenerating || !topic}
                className={cn("w-full mt-8 text-white py-4 rounded-2xl font-display font-bold text-sm shadow-xl transition-all disabled:grayscale disabled:opacity-50 flex items-center justify-center gap-2 group", config.accent, config.shadow)}
              >
                {isGenerating ? (
                  <RefreshCcw className="animate-spin" size={18} />
                ) : (
                  <>
                    <Zap size={18} className="group-hover:rotate-12 transition-transform" />
                    Engage {platform === 'xhs' ? 'Viral Engine' : 'Article Engine'}
                  </>
                )}
              </button>
            </section>
          </div>

          {/* Middle Column: Preview (Column 5-8) */}
          <div className="lg:col-span-4 flex justify-center lg:sticky lg:top-24 h-[600px] md:h-[700px] lg:h-[calc(100vh-120px)]">
            <div className="relative w-full max-w-[320px] md:max-w-[340px] h-full">
              {/* Phone Frame */}
              <div className="relative bg-black rounded-[3rem] p-1.5 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3),0_25px_50px_-12px_rgba(0,0,0,0.25)] ring-1 ring-gray-800 h-full flex flex-col">
                <div className="bg-gray-50 rounded-[2.5rem] h-full overflow-hidden relative flex flex-col">
                  {/* Dynamic Island - Fixed relative to the frame */}
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-3xl z-50 flex items-center justify-between px-3">
                    <div className="w-1 h-1 rounded-full bg-gray-800"></div>
                    <div className="w-2 h-1 rounded-full bg-gray-800"></div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto no-scrollbar relative flex flex-col">
                    {/* Top Image Handle */}
                    <div className="relative aspect-[3/4] bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                      {isGeneratingImage && (
                        <div className="absolute inset-0 z-10 bg-white/40 flex flex-col items-center justify-center backdrop-blur-sm">
                          <RefreshCcw className={cn(config.text, "animate-spin mb-2")} size={24} />
                          <span className={cn("text-[10px] font-bold uppercase tracking-widest", config.text)}>Dreaming...</span>
                        </div>
                      )}
                      
                      {generatedImage ? (
                        <div className="relative w-full h-full">
                          <motion.img 
                            key={generatedImage}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            src={generatedImage} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                            onLoad={() => setIsGeneratingImage(false)}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              // Attempt to handle CORS or busy server with a retry-friendly message
                              target.style.display = 'none';
                              const parent = target.parentElement;
                              if (parent) {
                                const errorUI = document.createElement('div');
                                errorUI.className = "absolute inset-0 flex flex-col items-center justify-center bg-gray-100 p-6 text-center";
                                errorUI.innerHTML = `
                                  <div class="p-3 bg-white rounded-full shadow-sm mb-3">
                                    <svg class="w-6 h-6 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                  </div>
                                  <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none mb-1">Canvas Busy</p>
                                  <p class="text-[9px] text-gray-400">Synthesis engine is under load. Tap refresh to retry.</p>
                                `;
                                parent.appendChild(errorUI);
                              }
                              setIsGeneratingImage(false);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full p-4 flex flex-col justify-center">
                          {result ? (
                            <div className="space-y-2">
                              <h3 className="text-gray-400 font-bold text-[8px] uppercase tracking-widest mb-2 text-center">
                                {platform === 'xhs' ? 'Select Visual Direction' : 'Select Hero Illustration'}
                              </h3>
                              {(result.imagePrompts || []).map((prompt, i) => (
                                <button
                                  key={i}
                                  onClick={() => {
                                    setCurrentPromptIndex(i);
                                    handleGenerateImage();
                                  }}
                                  className={cn(
                                    "w-full text-left p-2.5 rounded-lg text-[9px] leading-tight transition-all border",
                                    currentPromptIndex === i 
                                      ? cn(config.lightBg, config.text, "border transition-colors", platform === 'xhs' ? 'border-[#FF2442]/20 font-medium' : 'border-[#07C160]/20 font-medium')                                      : "bg-white border-gray-100 text-gray-400 hover:border-gray-200"
                                  )}
                                >
                                  <div className="flex gap-2">
                                     <span className="shrink-0 font-black opacity-30">{i + 1}</span>
                                     <span className="line-clamp-3">{prompt}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3">
                              <ImageIcon size={32} className="text-gray-200" />
                            </div>
                          )}
                        </div>
                      )}

                    {generatedImage && (
                      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                        <button 
                          onClick={handleGenerateImage}
                          disabled={!result || isGeneratingImage}
                          className={cn("bg-white/90 backdrop-blur p-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 disabled:opacity-0 transition-all", config.text)}
                        >
                          <RefreshCcw size={12} />
                        </button>
                        <button 
                          onClick={() => setPlatformImages(prev => ({ ...prev, [platform]: null }))}
                          className="bg-white/90 backdrop-blur text-gray-400 p-2 rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
                        >
                          <Edit3 size={12} />
                        </button>
                      </div>
                    )}


                  </div>

                  {/* Content Area */}
                  {result ? (
                    <motion.div 
                      key="content"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-4 space-y-3"
                    >
                      <h1 className="text-sm font-bold text-gray-900 leading-snug">
                        {result.title}
                      </h1>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-bold text-gray-300 uppercase tracking-widest">Length:</span>
                        <span className="text-[8px] font-black text-gray-400 tabular-nums">{result.body.length} Characters</span>
                      </div>
                      <div className="text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap font-sans">
                        {result.body}
                      </div>

                      {result.location && (
                        <div className="flex items-center gap-1.5 bg-gray-100/50 self-start px-2 py-1 rounded-full">
                          <MapPin size={10} className={config.text} />
                          <span className="text-[9px] font-bold text-gray-500">{result.location}</span>
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1.5">
                        {(result.tags || []).map(tag => (
                          <span key={tag} className="text-[10px] font-bold text-blue-600">
                            #{tag.replace('#', '')}
                          </span>
                        ))}
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                         <div className="flex gap-4">
                           <button 
                            onClick={toggleFavorite} 
                            disabled={isSavingFav}
                            className="hover:scale-110 active:scale-95 transition-all outline-none"
                           >
                             <Heart 
                               size={20} 
                               className={cn(
                                 "transition-all duration-300", 
                                 result && favorites.some(f => f.title === result.title && f.topic === (result as any).topic || topic) 
                                   ? cn("fill-current", config.text) 
                                   : "text-gray-300"
                               )} 
                             />
                           </button>
                           <button 
                            onClick={() => {
                              const text = `${result.title}\n\n${result.body}`;
                              if (navigator.share) {
                                navigator.share({ title: result.title, text });
                              }
                            }}
                            className="hover:scale-110 active:scale-95 transition-all text-gray-300 hover:text-gray-400"
                           >
                             <Share2 size={20} />
                           </button>
                         </div>
                         <button 
                          onClick={() => {
                            const text = `${result.title}\n\n${result.body}\n\n${result.tags.join(' ')}`;
                            navigator.clipboard.writeText(text);
                          }}
                          className={cn("text-white text-[9px] font-bold py-1.5 px-4 rounded-full shadow-lg", config.accent, config.shadow)}
                         >
                           COPY
                         </button>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="p-10 text-center flex-1 flex flex-col justify-center">
                      {isGenerating ? (
                        <div className="space-y-6">
                          <div className="flex justify-center">
                            <motion.div 
                              animate={{ 
                                scale: [1, 1.1, 1],
                              }}
                              transition={{ duration: 2, repeat: Infinity }}
                              className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg", config.accent)}
                            >
                              <Zap size={28} className="text-white animate-pulse" />
                            </motion.div>
                          </div>
                          <div className="space-y-3">
                             <p className={cn("text-[11px] font-bold uppercase tracking-widest", config.text)}>
                               {platform === 'xhs' ? 'Dreaming Viral Copy' : 'Structuring Insights'}
                             </p>
                             <div className="flex justify-center gap-1.5">
                                {[0, 1, 2].map(i => (
                                  <motion.div
                                    key={i}
                                    animate={{ 
                                      y: [0, -4, 0],
                                      opacity: [0.3, 1, 0.3]
                                    }}
                                    transition={{ 
                                      duration: 1, 
                                      repeat: Infinity, 
                                      delay: i * 0.2,
                                      ease: "easeInOut"
                                    }}
                                    className={cn("w-2 h-2 rounded-full", config.accent)}
                                  />
                                ))}
                             </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] font-bold text-gray-300 uppercase tracking-widest italic">
                          {platform === 'xhs' ? 'RedNote Post Preview' : 'WeChat Article Preview'}<br />materializing soon
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

          {/* Right Column: Insights & Interpretation (Column 9-12) */}
          <div className="lg:col-span-4 space-y-6">
            {rating && (
              <motion.section 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-4">
                      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                        {platform === 'xhs' ? 'Viral Potential Index' : 'Article Impact Index'}
                      </h3>
                  <span className="px-2 py-0.5 bg-green-50 text-green-600 rounded text-[9px] font-bold">TOP 2%</span>
                </div>
                
                <div className="flex items-end gap-1 mb-6">
                  <span className={cn("text-4xl md:text-5xl font-display font-black leading-none", config.text)}>{rating.overallScore || rating.score}</span>
                  <span className="text-gray-300 font-bold text-lg">/100</span>
                </div>

                {/* Refinement Section */}
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                      <RefreshCcw size={12} className={config.text} />
                      Refine Direction
                    </h3>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {suggestedRefinements.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleGenerate(s)}
                        disabled={isGenerating}
                        className={cn(
                          "px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all hover:scale-105 active:scale-95 disabled:opacity-50",
                          config.lightBg, config.text, config.border.replace('border-', 'border-').replace('[', '[').replace(']', ']') + '/20'
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>

                  <div className="relative group">
                    <input
                      type="text"
                      value={refinement}
                      onChange={(e) => setRefinement(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && refinement && handleGenerate(refinement)}
                      placeholder="Or type specific adjustments..."
                      className={cn(
                        "w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-2 text-[11px] font-medium outline-none transition-all pr-12",
                        config.focusBorder
                      )}
                    />
                    <button
                      onClick={() => refinement && handleGenerate(refinement)}
                      disabled={isGenerating || !refinement}
                      className={cn(
                        "absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-white transition-all disabled:opacity-0 shadow-sm",
                        config.accent
                      )}
                    >
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                  <DimensionBar label="Hook" score={rating.visualPotential || rating.score} config={config} />
                  <DimensionBar label="SEO" score={rating.copywriting || rating.score} config={config} />
                  <DimensionBar label="Trend" score={rating.trendiness || rating.score} config={config} />
                  <DimensionBar label="CTR" score={rating.engagement || rating.score} config={config} />
                </div>
              </motion.section>
            )}
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  className="space-y-6"
                >
                  <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 relative overflow-hidden">
                    {isSyncing && (
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-gray-100">
                        <motion.div 
                          className={cn("h-full", config.accent)}
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                      </div>
                    )}
                    <h3 className="text-gray-400 font-bold text-[10px] uppercase tracking-widest mb-4 flex items-center justify-between">
                      English Interpretation
                      {isSyncing && <span className={cn("text-[8px] animate-pulse", config.text)}>Syncing Preview...</span>}
                    </h3>
                    <div className="space-y-4">
                      <input 
                        type="text"
                        value={result.englishTitle}
                        onChange={(e) => updateEnglishContent('englishTitle', e.target.value)}
                        className="w-full text-sm font-bold text-gray-900 bg-transparent border-none outline-none focus:ring-0 p-0"
                        placeholder="English Title"
                      />
                      <textarea
                        value={result.englishBody}
                        onChange={(e) => updateEnglishContent('englishBody', e.target.value)}
                        className="w-full text-[11px] text-gray-500 leading-relaxed min-h-[160px] md:min-h-[200px] bg-transparent border-none outline-none focus:ring-0 p-0 resize-none no-scrollbar"
                        placeholder="English Content"
                      />
                    </div>
                  </section>

                  <section className={cn("rounded-3xl p-6 border transition-all duration-500", platform === 'xhs' ? 'bg-[#FF2442]/[0.03] border-[#FF2442]/10' : 'bg-[#07C160]/[0.03] border-[#07C160]/10')}>
                    <h3 className={cn("font-bold text-[10px] uppercase tracking-widest mb-3", config.text)}>{platform === 'xhs' ? 'Algorithm Strategy' : 'Article Strategy'}</h3>
                    <ul className="space-y-3">
                      {Array.isArray(rating?.feedback) ? rating.feedback.map((item, i) => (
                        <li key={i} className="text-gray-600 text-[11px] leading-relaxed flex gap-2">
                          <span className={cn("font-black shrink-0", config.text)}>•</span>
                          <span className="italic font-medium">"{item}"</span>
                        </li>
                      )) : (
                        <li className={cn("text-[11px] leading-relaxed italic font-medium", config.text.replace('text-', 'text-'))}>
                          "{rating?.feedback}"
                        </li>
                      )}
                    </ul>
                  </section>
                </motion.div>
              ) : (
                <div className="h-[300px] md:h-full min-h-[300px] rounded-3xl border border-dashed border-gray-200 flex flex-col items-center justify-center text-center p-8 grayscale opacity-50 bg-white/50">
                  <BarChart3 size={40} className="text-gray-300 mb-4" />
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                    Simulation Ready<br />waiting for content parameters
                  </p>
                </div>
              )}
            </AnimatePresence>

            {favorites.length > 0 && (
              <motion.section 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                    <Heart size={12} className="fill-current text-[#FF2442]" />
                    Saved Outcomes
                  </h3>
                  <span className="text-[8px] font-bold text-gray-300 uppercase">{favorites.length} TOTAL</span>
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
                  {favorites.slice(0, 10).map((fav) => (
                    <motion.div 
                      key={fav.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group relative bg-gray-50 rounded-2xl p-4 border border-gray-100 hover:border-gray-200 transition-all cursor-pointer hover:shadow-md"
                        onClick={() => {
                          setTopic(fav.topic || "");
                          setPlatformPosts(prev => ({ ...prev, [fav.platform as Platform]: { ...fav } as any }));
                          setPlatform(fav.platform as Platform);
                          setPlatformRatings(prev => ({ ...prev, [fav.platform as Platform]: null }));
                          setPlatformRefinements(prev => ({ ...prev, [fav.platform as Platform]: [] }));
                          setPlatformImages(prev => ({ ...prev, [fav.platform as Platform]: null }));
                        }}
                      >
                       <div className="flex items-center gap-2 mb-2">
                         <div className={cn(
                           "px-2 py-0.5 rounded text-[8px] text-white font-bold uppercase",
                           PLATFORM_CONFIG[fav.platform as Platform]?.accent || "bg-gray-400"
                         )}>
                           {PLATFORM_CONFIG[fav.platform as Platform]?.name || "Post"}
                         </div>
                         <span className="text-[9px] font-bold text-gray-400">
                           {fav.topic}
                         </span>
                       </div>
                       <h4 className="text-[11px] font-bold text-gray-900 line-clamp-1 mb-1">
                         {fav.title}
                       </h4>
                       <p className="text-[10px] text-gray-500 line-clamp-2 leading-relaxed">
                         {fav.body}
                       </p>
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFavorite(fav.id);
                        }}
                        className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/80 backdrop-blur text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                       >
                         <Trash2 size={12} />
                       </button>
                    </motion.div>
                  ))}
                  {favorites.length > 10 && (
                    <p className="text-[9px] text-center text-gray-400 font-bold uppercase tracking-wider pt-2 opacity-50">
                      Archive available in Cloud
                    </p>
                  )}
                </div>
              </motion.section>
            )}
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-gray-100">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-display font-black text-gray-900 tracking-tight flex items-center gap-3">
                      <SettingsIcon size={24} className={config.text} />
                      Settings
                    </h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">Configure your writing style</p>
                  </div>
                  <button 
                    onClick={() => setShowSettingsModal(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Tab Switcher */}
                <div className="flex p-1 bg-gray-50 rounded-2xl gap-1">
                  <button
                    onClick={() => setSettingsTab("identity")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      settingsTab === "identity" 
                        ? "bg-white text-gray-900 shadow-sm" 
                        : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <Users size={14} />
                    Identity
                  </button>
                  <button
                    onClick={() => setSettingsTab("engine")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                      settingsTab === "engine" 
                        ? "bg-white text-gray-900 shadow-sm" 
                        : "text-gray-400 hover:text-gray-600"
                    )}
                  >
                    <Zap size={14} />
                    Engine
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[60vh] p-8 space-y-8 scrollbar-hide">
                {settingsTab === "identity" ? (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                {/* Saved Identities Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                      <Users size={12} className={config.text} />
                      Saved Identities
                    </label>
                  </div>
                  <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1 min-h-[120px]">
                    {/* Empty Seat for New Identity */}
                    <button 
                      onClick={() => {
                        setActivePersonaId(null);
                        setPersona("");
                        setPersonaRole(PERSONA_ROLES[0].name);
                      }}
                      className={cn(
                        "flex-shrink-0 w-40 p-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 h-[100px]",
                        activePersonaId === null 
                          ? cn(config.border, config.lightBg, "bg-opacity-50 border-solid shadow-inner") 
                          : "border-gray-100 bg-gray-50/50 hover:border-gray-200"
                      )}
                    >
                      <div className={cn("p-1.5 rounded-full", config.lightBg)}>
                        <Plus size={14} className={config.text} />
                      </div>
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">New Identity</span>
                    </button>

                    {(personas || []).map((p) => (
                      <div 
                        key={p.id}
                        onClick={() => {
                          setActivePersonaId(p.id);
                          setPersona(p.detail);
                          setPersonaRole(p.role);
                        }}
                        className={cn(
                          "flex-shrink-0 w-40 p-4 rounded-2xl border transition-all cursor-pointer group relative h-[100px] flex flex-col justify-center",
                          activePersonaId === p.id 
                            ? cn(config.border, config.lightBg, "shadow-md") 
                            : "border-gray-100 bg-white hover:border-gray-200 shadow-sm"
                        )}
                      >
                        <div className={cn(
                          "text-[8px] font-bold uppercase tracking-widest mb-2 px-1.5 py-0.5 rounded inline-block self-start",
                          activePersonaId === p.id ? cn("bg-white", config.text) : "bg-gray-50 text-gray-400"
                        )}>
                          {p.role}
                        </div>
                        <p className="text-[10px] font-bold text-gray-900 line-clamp-2 leading-tight">
                          {p.detail}
                        </p>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deletePersona(p.id);
                          }}
                          className="absolute top-2 right-2 p-1 rounded-md text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Author Identity Section moved here */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                      <Users size={16} className={config.text} />
                      Author Identity (Voice)
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONA_ROLES.map((role) => (
                      <button
                        key={role.name}
                        onClick={() => setPersonaRole(role.name)}
                        className={cn(
                          "py-3 px-4 rounded-2xl text-[11px] font-bold transition-all border text-center relative group",
                          personaRole === role.name
                            ? cn("text-white", config.accent, config.border)
                            : "bg-gray-50 border-gray-100 text-gray-500 hover:border-gray-200"
                        )}
                      >
                        {role.name}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-black text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl">
                          {role.description}
                        </div>
                      </button>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest pl-1">Detailed Persona</label>
                    <textarea
                      value={persona}
                      onChange={(e) => setPersona(e.target.value)}
                      placeholder='e.g. "Tiago, a trendy lifestyle vlogger focused on minimalism" or "Official brand voice for a high-end tech startup"'
                      rows={3}
                      className={cn("w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 text-xs font-medium outline-none transition-all resize-none", config.focusBorder)}
                    />
                  </div>
                </div>

                <div className="bg-blue-50/50 rounded-2xl p-4 border border-blue-100">
                  <div className="flex gap-3">
                    <BrainCircuit size={20} className="text-blue-500 shrink-0" />
                    <div>
                      <p className="text-[11px] font-bold text-blue-900 mb-1">AI Context Mapping</p>
                      <p className="text-[10px] text-blue-700 leading-relaxed">
                        These settings directly influence how Gemini personas are constructed. 
                        Your "Voice" will be consistent across all platforms.
                      </p>
                    </div>
                  </div>
                </div>

                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="space-y-8"
                  >
                    {/* API Configuration Section */}
                    <div className="space-y-6">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                          <Key size={16} className={config.text} />
                          Engine Configuration
                        </label>
                      </div>
                      
                      {/* Gemini API Key */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                           <label className="text-[10px] font-bold text-gray-900 uppercase tracking-widest pl-1">Gemini / LLM Engine</label>
                           {isSystemDefault ? (
                             <span className="text-[8px] font-bold text-green-500 uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded">System Default (Connected)</span>
                           ) : (
                             <button 
                               onClick={() => {
                                 const defaultKey = process.env.GEMINI_API_KEY || "";
                                 setApiKey(defaultKey);
                                 localStorage.removeItem('gemini_api_key');
                               }}
                               className="text-[8px] font-bold text-red-500 hover:text-red-700 uppercase tracking-widest"
                             >
                               Reset to Default
                             </button>
                           )}
                        </div>
                        <div className="relative group">
                          <input
                            type={showApiKey ? "text" : "password"}
                            value={isSystemDefault && !showApiKey ? "****************" : apiKey}
                            readOnly={isSystemDefault && !showApiKey}
                            onChange={(e) => {
                              if (isSystemDefault && !showApiKey) return;
                              const newKey = e.target.value;
                              setApiKey(newKey);
                              localStorage.setItem('gemini_api_key', newKey);
                            }}
                            placeholder="Enter your custom Gemini API Key"
                            className={cn(
                              "w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-12 py-3 text-xs font-mono outline-none transition-all",
                              isSystemDefault && !showApiKey ? "cursor-default opacity-50" : config.focusBorder
                            )}
                          />
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300">
                            <BrainCircuit size={14} />
                          </div>
                          <button 
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500 transition-colors"
                          >
                            {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-400 leading-relaxed pl-1">
                          {isSystemDefault 
                            ? "Protected by AI Studio Secrets. The displayed value 'MY_GEMINI_API_KEY' is a security alias for your real key, which is used securely."
                            : "Currently using your custom API key. This key is stored locally and overrides the system default engine."}
                        </p>
                      </div>

                      {/* Image Generation API Key */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                           <label className="text-[10px] font-bold text-gray-900 uppercase tracking-widest pl-1">Image Generation Engine</label>
                           {!imageApiKey && <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest bg-gray-100 px-1.5 py-0.5 rounded">Pollinations (Default/Free)</span>}
                        </div>
                        <div className="relative group">
                          <input
                            type={showImageApiKey ? "text" : "password"}
                            value={imageApiKey}
                            onChange={(e) => {
                              const newKey = e.target.value;
                              setImageApiKey(newKey);
                              localStorage.setItem('image_api_key', newKey);
                            }}
                            placeholder="Optional: OpenAI/DALL-E API Key"
                            className={cn("w-full bg-gray-50 border border-gray-100 rounded-2xl pl-10 pr-12 py-3 text-xs font-mono outline-none transition-all", config.focusBorder)}
                          />
                          <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300">
                            <ImageIcon size={14} />
                          </div>
                          <button 
                            onClick={() => setShowImageApiKey(!showImageApiKey)}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-300 hover:text-gray-500 transition-colors"
                          >
                            {showImageApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                        <p className="text-[9px] text-gray-400 leading-relaxed pl-1">
                          {imageApiKey 
                            ? "Custom Image API Key active. High-fidelity synthesis is enabled." 
                            : "Using dynamic synthesis from Pollinations. No API key required for standard generation."}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                <button
                  onClick={() => setShowSettingsModal(false)}
                  className="px-6 py-3 rounded-2xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleSavePersona();
                    setShowSettingsModal(false);
                  }}
                  className={cn("px-8 py-3 rounded-2xl text-xs font-bold text-white shadow-lg transition-all hover:scale-105 active:scale-95", config.accent)}
                >
                  {activePersonaId ? "Update Identity" : "Save as New Identity"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inspiration Hub Modal */}
      <AnimatePresence>
        {showInspirationModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInspirationModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col h-[85vh]"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-white z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <Feather size={24} className="text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-black text-gray-900 tracking-tight">Inspiration Hub</h3>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">Capturing blurred feelings before processing</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowInspirationModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex flex-1 overflow-hidden">
                {/* Left: Editor */}
                <div className="w-1/2 p-8 border-r border-gray-100 bg-gray-50/50 flex flex-col">
                   <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Capture New Moment</h4>
                   <textarea
                     value={rawNote}
                     onChange={(e) => setRawNote(e.target.value)}
                     placeholder="What's blurring your mind? Jot it down here. Don't worry about being perfect. This is just for you."
                     className="flex-1 w-full bg-white border border-gray-100 rounded-[32px] p-6 text-sm text-gray-700 outline-none focus:ring-2 ring-amber-100 transition-all resize-none shadow-inner"
                   />
                   <div className="mt-4 flex justify-end">
                      <button
                        onClick={saveInspiration}
                        disabled={isSavingNote || !rawNote.trim()}
                        className="flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-2xl text-xs font-bold shadow-lg shadow-amber-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 transition-all"
                      >
                         <Save size={14} />
                         {isSavingNote ? 'Saving...' : 'Drop into Hub'}
                      </button>
                   </div>
                </div>

                {/* Right: List */}
                <div className="w-1/2 overflow-y-auto p-8 bg-white scrollbar-hide">
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Saved Moments ({inspirations.length})</h4>
                  <div className="space-y-4">
                    {inspirations.length === 0 ? (
                      <div className="py-20 text-center opacity-30 grayscale flex flex-col items-center">
                         <Feather size={48} className="mb-4" />
                         <p className="text-[10px] font-bold uppercase tracking-widest">No blurry feelings captured yet</p>
                      </div>
                    ) : (
                      inspirations.map((note) => (
                        <motion.div 
                          key={note.id}
                          layout
                          className="bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-xl hover:-translate-y-1 transition-all group relative"
                        >
                          <p className="text-sm text-gray-700 leading-relaxed italic mb-6">
                            "{note.text}"
                          </p>
                          <div className="flex items-center justify-between border-t border-gray-50 pt-4">
                            <span className="text-[9px] font-bold text-gray-300 uppercase">
                               {formatDate(note.createdAt)}
                            </span>
                            <div className="flex items-center gap-2">
                               <button 
                                 onClick={() => deleteInspiration(note.id)}
                                 className="p-1.5 text-gray-200 hover:text-red-400 transition-colors"
                               >
                                  <Trash2 size={12} />
                                </button>
                               <button 
                                 onClick={() => transformInspiration(note.text)}
                                 className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-3 py-1.5 rounded-xl text-[10px] font-bold hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                               >
                                  <Zap size={10} />
                                  Transform to Content
                               </button>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50/50 text-center border-t border-amber-100/20">
                 <p className="text-[9px] text-amber-600 font-bold uppercase tracking-widest">Understanding yourself is the first step to being understood</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Content Matrix Modal */}
      <AnimatePresence>
        {showMatrixModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMatrixModal(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-6xl bg-[#F8F9FD] rounded-[48px] shadow-2xl overflow-hidden flex flex-col h-[90vh]"
            >
              {/* Header */}
              <div className="p-10 pb-6 flex items-center justify-between bg-white border-b border-gray-100">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 rounded-[24px] bg-indigo-50 flex items-center justify-center shadow-inner">
                    <Calendar size={32} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-display font-black text-gray-900 tracking-tight">Content Matrix</h3>
                    <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">30-Day Strategic Roadmap</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                   {matrixItems.length > 0 && !isBatchGenerating && (
                     <button
                       onClick={handleBatchGenerate}
                       className="flex items-center gap-2 bg-indigo-600 text-white px-8 py-3.5 rounded-[20px] text-sm font-bold shadow-xl shadow-indigo-200 hover:scale-105 active:scale-95 transition-all"
                     >
                       <Zap size={18} />
                       Batch Generate All
                     </button>
                   )}
                   {isBatchGenerating && (
                     <div className="flex items-center gap-4 bg-white border border-gray-100 px-6 py-3 rounded-[20px] shadow-sm">
                        <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${batchProgress}%` }}
                             className="h-full bg-indigo-500"
                           />
                        </div>
                        <span className="text-[10px] font-black text-indigo-600">{batchProgress}%</span>
                     </div>
                   )}
                   <button 
                    onClick={() => setShowMatrixModal(false)}
                    className="p-3 hover:bg-gray-100 rounded-[20px] transition-all text-gray-400"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Grid Content */}
              <div className="flex-1 overflow-y-auto p-10 scrollbar-hide">
                {isGeneratingMatrix ? (
                  <div className="h-full flex flex-col items-center justify-center space-y-6">
                    <div className="relative w-24 h-24">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-8 border-indigo-50 border-t-indigo-500 rounded-full"
                      />
                      <Calendar size={32} className="absolute inset-0 m-auto text-indigo-500 animate-pulse" />
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900">Assembling your empire...</p>
                      <p className="text-gray-400 text-xs mt-1 font-medium italic">Scanning personas & history to prevent fatigue</p>
                    </div>
                  </div>
                ) : matrixItems.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {(matrixItems || []).map((item, idx) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="bg-white rounded-[32px] p-6 border border-gray-100 hover:border-indigo-100 hover:shadow-xl hover:-translate-y-1 transition-all group relative flex flex-col"
                      >
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex flex-col">
                             <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">Day {item.day}</span>
                             <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter bg-gray-50 px-2 py-0.5 rounded-full">{item.mood}</span>
                          </div>
                          {batchResults[item.id] ? (
                            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                               <CheckCircle2 size={16} className="text-green-500" />
                            </div>
                          ) : (
                            <button 
                              onClick={() => {
                                setMatrixItems(prev => prev.filter(p => p.id !== item.id));
                              }}
                              className="p-1.5 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        
                        <h4 className="text-lg font-bold text-gray-900 leading-tight mb-3 line-clamp-2">
                           {item.title}
                        </h4>
                        
                        <p className="text-xs text-gray-500 leading-relaxed mb-6 flex-1">
                           {item.reasoning}
                        </p>

                        <div className="mt-auto pt-4 border-t border-dashed border-gray-100">
                           {batchResults[item.id] ? (
                             <button
                               onClick={() => {
                                  setPlatformPosts(prev => ({ ...prev, [platform]: batchResults[item.id] }));
                                  setTopic(item.title);
                                  setShowMatrixModal(false);
                               }}
                               className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all"
                             >
                               <Edit3 size={12} />
                               Enter Workspace
                             </button>
                           ) : (
                             <div className="flex items-center gap-2">
                               <button 
                                 onClick={async () => {
                                    // Refresh this specific item (mocked as removal for now, or could re-generate)
                                    setMatrixItems(prev => prev.filter(p => p.id !== item.id));
                                 }}
                                 className="flex-1 bg-gray-50 text-gray-400 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-gray-100 transition-all"
                               >
                                  Refresh
                               </button>
                               <button 
                                 onClick={() => {
                                   setTopic(item.title);
                                   setMood(item.mood);
                                   setShowMatrixModal(false);
                                 }}
                                 className="flex-1 bg-indigo-50 text-indigo-600 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all"
                               >
                                  Focus
                               </button>
                             </div>
                           )}
                        </div>
                      </motion.div>
                    ))}
                    
                    {/* Add New Hook */}
                    <button 
                      onClick={() => {
                         const newDay = (matrixItems || []).length > 0 ? Math.max(...(matrixItems || []).map(m => m.day)) + 2 : 1;
                         setMatrixItems(prev => [...(prev || []), {
                           id: Math.random().toString(36).substr(2, 9),
                           title: "Untitled Genius Moment",
                           day: newDay,
                           mood: "Authentic",
                           audience: "Core Tribe",
                           reasoning: "Manually added to the sequence"
                         }]);
                      }}
                      className="border-2 border-dashed border-gray-200 rounded-[32px] p-6 flex flex-col items-center justify-center gap-4 text-gray-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/10 transition-all group"
                    >
                       <div className="w-12 h-12 rounded-2xl border-2 border-dashed border-current flex items-center justify-center group-hover:scale-110 transition-transform">
                          <Plus size={24} />
                       </div>
                       <span className="text-[10px] font-black uppercase tracking-widest">Inject Idea</span>
                    </button>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-6 max-w-sm mx-auto">
                    <div className="w-24 h-24 bg-white rounded-[32px] shadow-sm flex items-center justify-center mb-4">
                       <Calendar size={48} className="text-gray-200" />
                    </div>
                    <div className="space-y-2">
                       <h4 className="text-xl font-bold text-gray-900">Your Matrix is Empty</h4>
                       <p className="text-gray-500 text-sm leading-relaxed">
                         Ready to visualize your next month? I'll build a custom content sequence based on your persona.
                       </p>
                    </div>
                    <button
                      onClick={handleGenerateMatrix}
                      className="w-full bg-indigo-600 text-white py-4 rounded-[24px] text-sm font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                    >
                      Construct Monthly Plan
                    </button>
                  </div>
                )}
              </div>

              <div className="px-10 py-6 bg-white border-t border-gray-100 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="flex -space-x-2">
                       {[1,2,3].map(i => (
                         <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 flex items-center justify-center overflow-hidden">
                            <Users size={12} className="text-gray-400" />
                         </div>
                       ))}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Designed for your niche</span>
                 </div>
                 <p className="text-[10px] text-gray-400 font-medium tracking-wide italic">AI-generated schedule based on historical gaps & persona DNA</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Strategy Assistant Modal */}
      <AnimatePresence>
        {showStrategyModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowStrategyModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
            >
              <div className="p-8 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
                    <Sparkles size={24} className="text-amber-500" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-display font-black text-gray-900 tracking-tight">Strategy Assistant</h3>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mt-0.5">What to post next?</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowStrategyModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 pt-4 space-y-6 scrollbar-hide">
                {isGeneratingStrategy ? (
                  <div className="py-20 text-center space-y-4">
                    <div className="relative w-16 h-16 mx-auto">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        className="absolute inset-0 border-4 border-amber-100 border-t-amber-500 rounded-full"
                      />
                      <Sparkles size={24} className="absolute inset-0 m-auto text-amber-500 animate-pulse" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-gray-900 font-bold text-sm">Analyzing your content DNA...</p>
                      <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest">Identifying patterns & gaps</p>
                    </div>
                  </div>
                ) : favorites.length === 0 ? (
                  <div className="py-12 text-center space-y-4 px-6">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto">
                       <Heart size={24} className="text-gray-200" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-gray-900 font-bold text-sm">Your Saved List is Empty</p>
                       <p className="text-gray-500 text-xs leading-relaxed">
                         To generate a personalized content strategy, try saving some of your favorite creations first. 
                         I'll analyze them to suggest diverse new angles!
                       </p>
                    </div>
                    <button 
                      onClick={() => setShowStrategyModal(false)}
                      className="text-[10px] font-black uppercase text-amber-600 hover:text-amber-700 tracking-widest bg-amber-50 px-4 py-2 rounded-xl transition-all"
                    >
                      Got it
                    </button>
                  </div>
                ) : contentStrategy ? (
                  <div className="space-y-8">
                    {/* Analysis Section */}
                    <div className="bg-gray-50 rounded-3xl p-6 border border-gray-100 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                         <BarChart3 size={64} />
                      </div>
                      <h4 className="text-[10px] font-bold text-amber-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                        <BrainCircuit size={14} />
                        Intelligence Summary
                      </h4>
                      <p className="text-sm text-gray-700 leading-relaxed font-medium italic">
                        "{contentStrategy.analysis}"
                      </p>
                    </div>

                    {/* Recommendations */}
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1">Curated Next Moves</h4>
                      <div className="grid gap-4">
                        {(contentStrategy.recommendations || []).map((rec, i) => (
                          <motion.button
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            onClick={() => {
                              setTopic(rec.title);
                              setMood(rec.suggestedMood);
                              setShowStrategyModal(false);
                            }}
                            className="bg-white border border-gray-100 p-6 rounded-3xl hover:border-amber-200 hover:bg-amber-50/30 transition-all text-left group"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <span className="text-[8px] font-black uppercase bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full tracking-widest">
                                {rec.suggestedMood}
                              </span>
                              <ArrowRight size={14} className="text-gray-300 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                            </div>
                            <h5 className="font-bold text-gray-900 mb-2 truncate">
                              {rec.title}
                            </h5>
                            <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
                              {rec.description}
                            </p>
                            <div className="flex items-start gap-2 bg-white/50 p-3 rounded-2xl border border-dashed border-gray-100">
                               <Zap size={10} className="text-amber-500 mt-1 shrink-0" />
                               <p className="text-[10px] text-gray-400 leading-tight">
                                 <span className="font-bold text-gray-600 uppercase tracking-tighter mr-1">WHY:</span>
                                 {rec.reason}
                               </p>
                            </div>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                     <p className="text-gray-400">Failed to generate strategy. Please try again.</p>
                  </div>
                )}
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex justify-center">
                 <p className="text-[10px] text-gray-400 font-medium tracking-wide">AI-powered content variety engine</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Favorites Modal */}
      <AnimatePresence>
        {showFavsModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFavsModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-display font-black text-gray-900 tracking-tight flex items-center gap-3">
                    <Heart size={24} className="fill-current text-[#FF2442]" />
                    Saved Creations
                  </h3>
                  <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-1">{favorites.length} TOTAL SAVED ITEMS</p>
                </div>
                <button 
                  onClick={() => setShowFavsModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400"
                >
                  <RefreshCcw size={20} className="rotate-45" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
                {favorites.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart size={40} className="mx-auto text-gray-100 mb-4" />
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No saved outcomes yet</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {favorites.map((fav) => (
                      <motion.div 
                        key={fav.id}
                        layoutId={fav.id}
                        className="group relative bg-gray-50 rounded-2xl p-5 border border-gray-100 hover:border-gray-200 transition-all cursor-pointer hover:shadow-md"
                        onClick={() => {
                          setTopic(fav.topic || "");
                          setPlatformPosts(prev => ({ ...prev, [fav.platform as Platform]: { ...fav } as any }));
                          setPlatform(fav.platform as Platform);
                          setPlatformRatings(prev => ({ ...prev, [fav.platform as Platform]: null }));
                          setPlatformRefinements(prev => ({ ...prev, [fav.platform as Platform]: [] }));
                          setPlatformImages(prev => ({ ...prev, [fav.platform as Platform]: null }));
                          setShowFavsModal(false);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                         <div className="flex items-center gap-2 mb-3">
                           <div className={cn(
                             "px-2 py-0.5 rounded text-[8px] text-white font-bold uppercase",
                             PLATFORM_CONFIG[fav.platform as Platform]?.accent || "bg-gray-400"
                           )}>
                             {PLATFORM_CONFIG[fav.platform as Platform]?.name || "Post"}
                           </div>
                           <span className="text-[9px] font-bold text-gray-400">
                             {fav.topic}
                           </span>
                         </div>
                         <h4 className="text-sm font-bold text-gray-900 line-clamp-1 mb-2">
                           {fav.title}
                         </h4>
                         <p className="text-[11px] text-gray-500 line-clamp-3 leading-relaxed">
                           {fav.body}
                         </p>
                         <div className="flex items-center justify-between mt-4">
                           <span className="text-[8px] font-bold text-gray-300 uppercase">
                             {formatDate(fav.createdAt)}
                           </span>
                           <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFavorite(fav.id);
                            }}
                            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 transition-all"
                           >
                             <Trash2 size={12} />
                           </button>
                         </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DimensionBar({ label, score, config }: { label: string; score: number; config: any }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-gray-600">
        <span>{label}</span>
        <span className={score > 80 ? config.text : "text-gray-400"}>{score}%</span>
      </div>
      <div className="w-full h-2 bg-gray-50 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1.5, ease: "circOut" }}
          className={cn("h-full rounded-full transition-all duration-1000", config.accent)}
        />
      </div>
    </div>
  );
}
