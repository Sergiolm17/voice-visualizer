// src/components/audio-visualizer/AudioVisualizer.tsx
import React, { useState, useRef, useEffect } from "react";
import { useAudioVisualizerLogic } from "./useAudioVisualizerLogic";
import AudioVisualizerView from "./AudioVisualizerView";
import type {
  AudioSourceType,
  AudioVisualizerLogicOptions,
  VisualizerConfig,
} from "./types";
import { DEFAULT_VISUALIZER_CONFIG } from "./types";
import "./styles/AudioVisualizer.css"; // Importa los estilos

interface AudioVisualizerProps {
  initialSourceType?: AudioSourceType;
  logicOptions?: AudioVisualizerLogicOptions;
  viewConfig?: Partial<VisualizerConfig>; // Permitir configuración parcial
  containerWidth?: number;
  containerHeight?: number;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  initialSourceType = "microphone",
  logicOptions,
  viewConfig,
  containerWidth = 380, // Default width
  containerHeight = 380, // Default height
}) => {
  const {
    smoothedVolume,
    audioState,
    errorMessage,
    initializeAudio,
    togglePlayPause,
    stopAudio,
  } = useAudioVisualizerLogic(logicOptions);

  const [currentSourceType, setCurrentSourceType] =
    useState<AudioSourceType>(initialSourceType);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mergedViewConfig = { ...DEFAULT_VISUALIZER_CONFIG, ...viewConfig };

  const handleInitialize = (source: AudioSourceType, file?: File) => {
    setCurrentSourceType(source);
    initializeAudio(source, file);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleInitialize("file", file);
    }
  };

  const getButtonText = () => {
    if (audioState === "initializing") return "Canalizando...";
    if (audioState === "running") return "Pausar Magia";
    if (audioState === "suspended") return "Reanudar Magia";
    if (audioState === "error") return "Error";
    if (currentSourceType === "microphone") return "Activar Magia (Mic)";
    return "Activar Magia (Archivo)";
  };

  const handleMainButtonClick = () => {
    if (audioState === "running" || audioState === "suspended") {
      togglePlayPause();
    } else if (audioState === "idle" || audioState === "error") {
      if (currentSourceType === "microphone") {
        handleInitialize("microphone");
      } else if (currentSourceType === "file") {
        fileInputRef.current?.click();
      }
    }
  };

  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  return (
    <div className="audio-visualizer-wrapper">
      <div
        className="visualizer-container"
        style={{ width: `${containerWidth}px`, height: `${containerHeight}px` }}
      >
        <AudioVisualizerView
          smoothedVolume={smoothedVolume}
          width={containerWidth}
          height={containerHeight}
          config={mergedViewConfig}
        />
      </div>

      <div className="controls-container">
        <button
          className="control-button"
          onClick={handleMainButtonClick}
          disabled={audioState === "initializing"}
        >
          {getButtonText()}
        </button>

        {(audioState === "idle" || audioState === "error") && (
          <>
            <button
              className="control-button"
              onClick={() => setCurrentSourceType("microphone")}
              disabled={currentSourceType === "microphone"}
              style={{
                backgroundColor:
                  currentSourceType === "microphone" ? "#4CAF50" : undefined,
              }}
            >
              Usar Micrófono
            </button>

            <label htmlFor="audioFile" className="file-input-label">
              {currentSourceType === "file"
                ? "Cambiar Archivo..."
                : "Usar Archivo de Audio"}
            </label>
            <input
              type="file"
              id="audioFile"
              className="file-input-hidden"
              accept="audio/*"
              ref={fileInputRef}
              onChange={handleFileChange}
              onClick={(e) => {
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </>
        )}

        {audioState !== "idle" &&
          audioState !== "error" &&
          audioState !== "initializing" && (
            <button
              className="control-button"
              onClick={() => {
                stopAudio();
              }}
              style={{ backgroundColor: "#d9534f" }}
            >
              Detener y Cambiar Fuente
            </button>
          )}
      </div>

      <p className={`status-message ${errorMessage ? "error-message" : ""}`}>
        {errorMessage ||
          (audioState === "running" &&
            `Fuente: ${
              currentSourceType === "microphone" ? "Micrófono" : "Archivo"
            }`) ||
          (audioState === "suspended" && "Pausado") ||
          `Estado: ${audioState}`}
      </p>
    </div>
  );
};

export default AudioVisualizer;
