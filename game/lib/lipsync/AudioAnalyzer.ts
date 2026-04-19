/**
 * Audio Analysis Engine for Lip Sync
 *
 * Analyzes audio files to extract phoneme timing information.
 * Converts speech audio to viseme sequences for real-time lip sync animation.
 *
 * Supports multiple backends:
 * 1. Web Speech API (built-in, limited)
 * 2. Deepgram API (cloud-based, high quality)
 * 3. OpenAI Whisper (powerful, accurate)
 */

import { Viseme, getVisemeFromPhoneme, VisemeFrame } from "./VisemeSystem";

export interface AudioAnalysisResult {
  text: string;
  phonemes: Array<{
    phoneme: string;
    startTime: number;
    endTime: number;
  }>;
  visemeFrames: VisemeFrame[];
  confidence: number;
}

type AudioAnalyzerInput = Blob | ArrayBuffer;

interface AudioAnalyzerBackend {
  analyzeAudio(audio: AudioAnalyzerInput): Promise<AudioAnalysisResult>;
}

/**
 * Deepgram API Audio Analyzer
 * Professional speech-to-text with phoneme-level timing
 * Requires: Deepgram API key
 */
export class DeepgramAnalyzer {
  private apiKey: string;
  private baseUrl = "https://api.deepgram.com/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeAudio(audioBuffer: AudioAnalyzerInput): Promise<AudioAnalysisResult> {
    try {
      const response = await fetch(`${this.baseUrl}/listen?model=nova-2&language=en`, {
        method: "POST",
        headers: {
          Authorization: `Token ${this.apiKey}`,
          "Content-Type": "application/octet-stream",
        },
        body: audioBuffer,
      });

      if (!response.ok) {
        throw new Error(`Deepgram API error: ${response.status}`);
      }

      const result = await response.json();
      return this.parseDeepgramResponse(result);
    } catch (error) {
      console.error("Deepgram analysis failed:", error);
      throw error;
    }
  }

  private parseDeepgramResponse(response: any): AudioAnalysisResult {
    const transcript = response.results?.channels?.[0]?.alternatives?.[0];
    if (!transcript) {
      throw new Error("No transcription in Deepgram response");
    }

    const text = transcript.transcript || "";
    const phonemes: Array<{ phoneme: string; startTime: number; endTime: number }> = [];
    const visemeFrames: VisemeFrame[] = [];

    // Extract word-level timing
    const words = transcript.words || [];
    words.forEach((word: any) => {
      const wordStart = word.start || 0;
      const wordEnd = word.end || wordStart;
      const wordText = word.word || "";

      // Simple phoneme extraction from word text
      // In production, use Deepgram's detailed phoneme response
      const estimatedPhonemes = this.estimatePhonemes(wordText);
      const phonemeDuration = (wordEnd - wordStart) / Math.max(estimatedPhonemes.length, 1);

      estimatedPhonemes.forEach((phoneme, idx) => {
        const startTime = wordStart + idx * phonemeDuration;
        const endTime = startTime + phonemeDuration;

        phonemes.push({ phoneme, startTime, endTime });

        const viseme = getVisemeFromPhoneme(phoneme);
        visemeFrames.push({
          viseme,
          startTime,
          endTime,
          confidence: 0.9,
        });
      });
    });

    return {
      text,
      phonemes,
      visemeFrames,
      confidence: transcript.confidence || 0.85,
    };
  }

  private estimatePhonemes(word: string): string[] {
    // Simple grapheme-to-phoneme estimation
    // In production, use a proper g2p model
    const phonemeMap: Record<string, string[]> = {
      a: ["a"],
      e: ["e"],
      i: ["i"],
      o: ["o"],
      u: ["u"],
      p: ["p"],
      b: ["b"],
      m: ["m"],
      f: ["f"],
      v: ["v"],
      t: ["t"],
      d: ["d"],
      n: ["n"],
      s: ["s"],
      z: ["z"],
      l: ["l"],
      r: ["r"],
      h: ["h"],
      w: ["w"],
      y: ["j"],
      sh: ["ʃ"],
      ch: ["tʃ"],
      th: ["θ"],
    };

    const phonemes: string[] = [];
    let i = 0;

    while (i < word.length) {
      // Check two-character combinations first
      const twoChar = word.substring(i, i + 2).toLowerCase();
      if (phonemeMap[twoChar]) {
        phonemes.push(...phonemeMap[twoChar]);
        i += 2;
        continue;
      }

      // Single character
      const char = word[i].toLowerCase();
      if (phonemeMap[char]) {
        phonemes.push(...phonemeMap[char]);
      }
      i++;
    }

    return phonemes.length > 0 ? phonemes : [word.toLowerCase()];
  }
}

/**
 * Web Speech API Analyzer
 * Free, built-in browser API (limited accuracy)
 */
export class WebSpeechAnalyzer {
  private recognition: any;

  constructor() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      throw new Error("Web Speech API not supported in this browser");
    }
    this.recognition = new SpeechRecognition();
  }

  async analyzeAudio(audioInput: AudioAnalyzerInput): Promise<AudioAnalysisResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const audioBlob = audioInput instanceof Blob ? audioInput : new Blob([audioInput]);

      reader.onload = async (e) => {
        try {
          const audioData = e.target?.result as ArrayBuffer;
          const audioContext = new (window as any).AudioContext();
          const audioBuffer = await audioContext.decodeAudioData(audioData.slice(0));

          // Web Speech API transcription
          const text = await this.transcribeWithWebSpeech(audioBuffer);

          // Simple phoneme estimation
          const phonemes = this.extractPhonemes(text);
          const visemeFrames = this.phonemesToVisemes(phonemes, audioBuffer.duration);

          resolve({
            text,
            phonemes,
            visemeFrames,
            confidence: 0.7, // Web Speech has lower confidence
          });
        } catch (error) {
          reject(error);
        }
      };

      reader.readAsArrayBuffer(audioBlob);
    });
  }

  private async transcribeWithWebSpeech(audioBuffer: AudioBuffer): Promise<string> {
    return new Promise((resolve, reject) => {
      this.recognition.onstart = () => console.log("Speech recognition started");
      this.recognition.onresult = (event: any) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        resolve(transcript);
      };
      this.recognition.onerror = (event: any) => reject(event.error);
      this.recognition.start();
    });
  }

  private extractPhonemes(text: string): Array<{ phoneme: string; startTime: number; endTime: number }> {
    // Very simple phoneme extraction
    const phones = text.split("");
    const phonemes: Array<{ phoneme: string; startTime: number; endTime: number }> = [];
    const duration = 1; // Estimate 1 second total
    const phonemeDuration = duration / Math.max(phones.length, 1);

    phones.forEach((char, idx) => {
      phonemes.push({
        phoneme: char.toLowerCase(),
        startTime: idx * phonemeDuration,
        endTime: (idx + 1) * phonemeDuration,
      });
    });

    return phonemes;
  }

  private phonemesToVisemes(
    phonemes: Array<{ phoneme: string; startTime: number; endTime: number }>,
    totalDuration: number
  ): VisemeFrame[] {
    return phonemes.map(({ phoneme, startTime, endTime }) => ({
      viseme: getVisemeFromPhoneme(phoneme),
      startTime,
      endTime,
      confidence: 0.6,
    }));
  }
}

/**
 * OpenAI Whisper Analyzer
 * High-accuracy speech recognition
 * Requires: OpenAI API key
 */
export class WhisperAnalyzer {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeAudio(audioInput: AudioAnalyzerInput): Promise<AudioAnalysisResult> {
    try {
      const audioBlob = audioInput instanceof Blob ? audioInput : new Blob([audioInput]);
      const formData = new FormData();
      formData.append("file", audioBlob);
      formData.append("model", "whisper-1");
      formData.append("response_format", "verbose_json");

      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const result = await response.json();
      return this.parseWhisperResponse(result);
    } catch (error) {
      console.error("Whisper analysis failed:", error);
      throw error;
    }
  }

  private parseWhisperResponse(response: any): AudioAnalysisResult {
    const text = response.text || "";

    // Whisper doesn't provide word-level timing by default
    // Estimate timing based on character distribution
    const visemeFrames = this.estimateVisemeFrames(text, response.duration || 1);

    return {
      text,
      phonemes: [], // Whisper doesn't provide phoneme-level data
      visemeFrames,
      confidence: 0.85,
    };
  }

  private estimateVisemeFrames(text: string, duration: number): VisemeFrame[] {
    const chars = text.split("");
    const charDuration = duration / Math.max(chars.length, 1);
    const frames: VisemeFrame[] = [];

    chars.forEach((char, idx) => {
      const startTime = idx * charDuration;
      const endTime = (idx + 1) * charDuration;
      const viseme = getVisemeFromPhoneme(char);

      frames.push({
        viseme,
        startTime,
        endTime,
        confidence: 0.7,
      });
    });

    return frames;
  }
}

/**
 * Audio Manager - Choose and switch between analyzers
 */
export class AudioAnalyzerManager {
  private analyzer: AudioAnalyzerBackend;

  constructor(mode: "deepgram" | "whisper" | "webspeech", apiKey?: string) {
    if (mode === "deepgram" && !apiKey) {
      throw new Error("Deepgram API key required");
    }
    if (mode === "whisper" && !apiKey) {
      throw new Error("OpenAI API key required");
    }

    switch (mode) {
      case "deepgram":
        this.analyzer = new DeepgramAnalyzer(apiKey!);
        break;
      case "whisper":
        this.analyzer = new WhisperAnalyzer(apiKey!);
        break;
      case "webspeech":
        this.analyzer = new WebSpeechAnalyzer();
        break;
    }

    console.log(`✅ Audio analyzer initialized: ${mode}`);
  }

  async analyze(audio: AudioBuffer | Blob | ArrayBuffer): Promise<AudioAnalysisResult> {
    if (audio instanceof AudioBuffer) {
      throw new Error("AudioBuffer input is not supported directly. Convert it to Blob or ArrayBuffer first.");
    }

    return this.analyzer.analyzeAudio(audio);
  }
}

export default {
  DeepgramAnalyzer,
  WhisperAnalyzer,
  WebSpeechAnalyzer,
  AudioAnalyzerManager,
};
