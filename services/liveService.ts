import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Define LiveSession type locally as it is not exported from the SDK
type LiveSession = Awaited<ReturnType<GoogleGenAI['live']['connect']>>;

// Audio helpers
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// Live Service Class
export class LiveService {
  private ai: GoogleGenAI;
  private session: LiveSession | null = null;
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private nextStartTime = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async connect(onClose: () => void, onError: (e: Error) => void) {
    try {
        // 1. Check for MediaDevices support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Microphone access is not supported in this environment (HTTP or no hardware).");
        }

        // 2. Initialize Audio Contexts
        this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
        this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

        // 3. Request Microphone Access
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            console.error("getUserMedia error:", e);
            throw new Error("Could not access microphone. Please check permissions and ensure a microphone is connected.");
        }
      
        // 4. Connect to Gemini Live API
        const sessionPromise = this.ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
            onopen: () => {
                console.log("Live Session Connected");
                this.startAudioInput(sessionPromise);
            },
            onmessage: async (message: LiveServerMessage) => {
                const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio) {
                    await this.playAudioChunk(base64Audio);
                }
                
                if (message.serverContent?.interrupted) {
                    this.stopAudioPlayback();
                }
            },
            onclose: () => {
                console.log("Live Session Closed");
                this.cleanup();
                onClose();
            },
            onerror: (e) => {
                console.error("Live Session Error", e);
                // Convert ErrorEvent or other types to standard Error
                const errorObj = e instanceof Error ? e : new Error("WebSocket Error");
                onError(errorObj);
                this.cleanup();
            }
            },
            config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
            },
            systemInstruction: "You are a friendly friend. Chat casually.",
            }
        });
      
        this.session = await sessionPromise;

    } catch (err: any) {
      console.error("Failed to connect live session", err);
      onError(err instanceof Error ? err : new Error(err.message || "Unknown error"));
      this.cleanup();
    }
  }

  private startAudioInput(sessionPromise: Promise<LiveSession>) {
    if (!this.inputAudioContext || !this.stream) return;

    this.sourceNode = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmBlob = createBlob(inputData);
      
      sessionPromise.then(session => {
          session.sendRealtimeInput({ media: pcmBlob });
      });
    };

    this.sourceNode.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async playAudioChunk(base64: string) {
    if (!this.outputAudioContext) return;

    this.nextStartTime = Math.max(this.nextStartTime, this.outputAudioContext.currentTime);
    
    const audioBuffer = await decodeAudioData(
      decode(base64),
      this.outputAudioContext,
      24000,
      1
    );

    const source = this.outputAudioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.outputAudioContext.destination);
    
    source.addEventListener('ended', () => {
      this.sources.delete(source);
    });

    source.start(this.nextStartTime);
    this.nextStartTime += audioBuffer.duration;
    this.sources.add(source);
  }

  private stopAudioPlayback() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch (e) {
          // ignore
      }
    }
    this.sources.clear();
    this.nextStartTime = 0;
  }

  async disconnect() {
    if (this.session) {
        this.session.close();
    }
    this.cleanup();
  }

  private cleanup() {
    this.stopAudioPlayback();
    
    if (this.processor) {
        this.processor.disconnect();
        this.processor = null;
    }
    if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
    }
    if (this.stream) {
        this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
    }
    if (this.inputAudioContext) {
        this.inputAudioContext.close();
        this.inputAudioContext = null;
    }
    if (this.outputAudioContext) {
        this.outputAudioContext.close();
        this.outputAudioContext = null;
    }
    this.session = null;
  }
}