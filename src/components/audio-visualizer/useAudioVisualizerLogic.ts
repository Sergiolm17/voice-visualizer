// src/components/audio-visualizer/useAudioVisualizerLogic.ts
import { useState, useRef, useCallback, useEffect } from "react";
import type {
  AudioProcessingState,
  AudioSourceType,
  AudioVisualizerLogicOptions,
  UseAudioVisualizerLogicReturn,
} from "./types";

const DEFAULT_OPTIONS: Required<AudioVisualizerLogicOptions> = {
  fftSize: 256,
  smoothingTimeConstant: 0.35,
  smoothingFactor: 0.18,
};

export function useAudioVisualizerLogic(
  options?: AudioVisualizerLogicOptions
): UseAudioVisualizerLogicReturn {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const [audioState, setAudioState] = useState<AudioProcessingState>("idle");
  const [smoothedVolume, setSmoothedVolume] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<AudioNode | null>(null); // MediaStreamSource or AudioBufferSource
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const currentStreamRef = useRef<MediaStream | null>(null); // Para detener las pistas del micrófono

  const processAudio = useCallback(() => {
    if (
      !analyserRef.current ||
      !dataArrayRef.current ||
      audioContextRef.current?.state === "suspended"
    ) {
      if (audioContextRef.current?.state === "suspended") {
        // Decaimiento suave si está suspendido
        setSmoothedVolume((prev) => Math.max(0, prev * 0.94));
      }
      animationFrameIdRef.current = requestAnimationFrame(processAudio);
      return;
    }

    analyserRef.current.getByteFrequencyData(dataArrayRef.current);
    let sum = 0;
    const relevantBins = Math.floor(dataArrayRef.current.length * 0.3);
    for (let i = 0; i < relevantBins; i++) {
      sum += dataArrayRef.current[i];
    }
    const averageVolume = relevantBins > 0 ? sum / relevantBins : 0;
    let normalizedVolume = Math.min(averageVolume / 128, 1.8);
    normalizedVolume = Math.pow(normalizedVolume, 0.75);
    normalizedVolume = Math.max(0, normalizedVolume);

    setSmoothedVolume((prevSmoothedVolume) => {
      const newVolume =
        prevSmoothedVolume * (1 - mergedOptions.smoothingFactor) +
        normalizedVolume * mergedOptions.smoothingFactor;
      return Math.min(newVolume, 2.0); // Cap general
    });

    animationFrameIdRef.current = requestAnimationFrame(processAudio);
  }, [mergedOptions.smoothingFactor]);

  const stopAudio = useCallback(() => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      // Si es un AudioBufferSourceNode y tiene un método stop, llamarlo
      if (
        "stop" in sourceNodeRef.current &&
        typeof sourceNodeRef.current.stop === "function"
      ) {
        try {
          // Puede fallar si ya está detenido o no ha empezado
          (sourceNodeRef.current as AudioBufferSourceNode).stop();
        } catch (e) {
          console.warn("AudioBufferSourceNode couldn't be stopped:", e);
        }
      }
      sourceNodeRef.current = null;
    }
    if (currentStreamRef.current) {
      currentStreamRef.current.getTracks().forEach((track) => track.stop());
      currentStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().then(() => {
        audioContextRef.current = null;
        analyserRef.current = null;
        dataArrayRef.current = null;
      });
    }
    setAudioState("idle");
    setSmoothedVolume(0);
  }, []);

  const initializeAudio = useCallback(
    async (sourceType: AudioSourceType, audioFile?: File) => {
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== "closed"
      ) {
        await audioContextRef.current.close(); // Cierra el contexto anterior si existe
      }

      setAudioState("initializing");
      setErrorMessage(null);

      try {
        const context = new (window.AudioContext ||
          (window as any).webkitAudioContext)();
        audioContextRef.current = context;

        const analyser = context.createAnalyser();
        analyser.fftSize = mergedOptions.fftSize;
        analyser.smoothingTimeConstant = mergedOptions.smoothingTimeConstant;
        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
        analyserRef.current = analyser;

        if (sourceType === "microphone") {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("getUserMedia not supported on your browser!");
          }
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
          currentStreamRef.current = stream; // Guardar para detener las pistas
          sourceNodeRef.current = context.createMediaStreamSource(stream);
        } else if (sourceType === "file" && audioFile) {
          const arrayBuffer = await audioFile.arrayBuffer();
          const audioBuffer = await context.decodeAudioData(arrayBuffer);
          const bufferSource = context.createBufferSource();
          bufferSource.buffer = audioBuffer;
          bufferSource.loop = true; // Opcional: hacer que el archivo se repita
          sourceNodeRef.current = bufferSource;
          bufferSource.start();
        } else {
          throw new Error("Invalid source type or missing audio file.");
        }

        sourceNodeRef.current.connect(analyserRef.current);
        // Conectamos el analizador al destino para escuchar el audio
        analyserRef.current.connect(context.destination);

        setAudioState("running");
        if (animationFrameIdRef.current)
          cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = requestAnimationFrame(processAudio);
      } catch (err) {
        console.error("Error setting up audio:", err);
        const message =
          err instanceof Error ? err.message : "An unknown error occurred.";
        setErrorMessage(`Error al acceder a la fuente de audio: ${message}`);
        setAudioState("error");
        stopAudio(); // Limpiar en caso de error
      }
    },
    [
      processAudio,
      stopAudio,
      mergedOptions.fftSize,
      mergedOptions.smoothingTimeConstant,
    ]
  );

  const togglePlayPause = useCallback(() => {
    if (!audioContextRef.current) return;

    if (audioContextRef.current.state === "running") {
      audioContextRef.current.suspend().then(() => setAudioState("suspended"));
    } else if (audioContextRef.current.state === "suspended") {
      audioContextRef.current.resume().then(() => setAudioState("running"));
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  return {
    smoothedVolume,
    audioState,
    errorMessage,
    initializeAudio,
    togglePlayPause,
    stopAudio,
    audioContext: audioContextRef.current || undefined,
    analyser: analyserRef.current || undefined,
  };
}
