// src/components/audio-visualizer/types.ts

export interface Particle {
  id: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  baseAngle: number;
  virtualLineIndex: number;
  radiusOffset: number;
  phaseSeed: number;
  reactivityFactor: number;
  currentAngleOffset: number;
  angularVelocity: number;
  angularAcceleration: number;
  targetAngularAcceleration: number;
  timeToChangeAccelerationTarget: number;
}

export type AudioSourceType = "microphone" | "file";

export type AudioProcessingState =
  | "idle"
  | "initializing"
  | "running"
  | "suspended"
  | "error";

export interface AudioVisualizerLogicOptions {
  fftSize?: number;
  smoothingTimeConstant?: number;
  smoothingFactor?: number; // Para el smoothedVolume
  // Podríamos añadir más configuraciones aquí si fueran necesarias
}

export interface UseAudioVisualizerLogicReturn {
  smoothedVolume: number;
  audioState: AudioProcessingState;
  errorMessage: string | null;
  initializeAudio: (
    sourceType: AudioSourceType,
    audioFile?: File
  ) => Promise<void>;
  togglePlayPause: () => void;
  stopAudio: () => void;
  audioContext?: AudioContext; // Exponer para control avanzado si es necesario
  analyser?: AnalyserNode; // Exponer para control avanzado si es necesario
}

export interface VisualizerViewProps {
  smoothedVolume: number;
  width: number;
  height: number;
  particleColor?: string;
  baseParticleSize?: number;
  // Añade aquí más props para personalizar la apariencia si es necesario
  // Por ejemplo, las constantes de deformación, número de partículas, etc.
  numVirtualLines?: number;
  particlesPerLine?: number;
  easeFactor?: number;
  lineSpacingVariation?: number;
  // ... y otros parámetros visuales del script original
  config: VisualizerConfig; // Agrupamos los parámetros de configuración visual
}

export interface VisualizerConfig {
  particleColor: string;
  baseParticleSize: number;
  numVirtualLines: number;
  particlesPerLine: number;
  easeFactor: number;
  lineSpacingVariation: number;
  baseRadiusFactor: number; // Factor para calcular baseRadius (e.g., 0.26 del script original)

  // Parámetros de deformación estática
  staticDeformParams: { freq: number; amp: number; speed: number }[];
  // Parámetros de deformación por volumen
  volumeDeformParams: { freq: number; amp: number; speed: number }[];

  // Parámetros de Rotación
  ROTATION_ENABLED: boolean;
  angularAccelerationEase: number;
  baseMaxTargetAngularAcceleration: number;
  baseMaxAngularVelocity: number;
  baseAngularDamping: number;
  volumeMultiplierForAngularAcceleration: number;
  volumeMultiplierForMaxAngularVelocity: number;
  volumePowerForRotation: number;
  minTimeForAccelerationChange: number;
  randomTimeForAccelerationChange: number;

  // Variación de tamaño de partícula
  minParticleSizeFactor: number;
  particleSizeVelocityScale: number;
  minParticleSize: number; // Tamaño mínimo absoluto de partícula
  maxParticleSize: number; // Tamaño máximo absoluto de partícula
  particleBlurFactor: number; // Factor de difuminado para partículas grandes
  haloCount?: number; // Número de halos concéntricos
  haloBaseAlpha?: number; // Opacidad base del halo más grande
}

export const DEFAULT_VISUALIZER_CONFIG: VisualizerConfig = {
  particleColor: "#f0f0f0",
  numVirtualLines: 6,
  particlesPerLine: 90,
  easeFactor: 0.09,
  lineSpacingVariation: 2.2,
  baseRadiusFactor: 0.26,
  staticDeformParams: [
    { freq: 4.5, amp: 2.5, speed: 0.0005 },
    { freq: 7.2, amp: 2.0, speed: 0.0003 },
  ],
  baseParticleSize: 1.2, // Tamaño base de cada partícula. SUBE para partículas más grandes, BAJA para más pequeñas.
  volumeDeformParams: [
    // Estos parámetros hacen que la nube de partículas se expanda y deforme con el sonido.
    // amp: SUBE para que la expansión/reacción al sonido sea mayor, BAJA para que sea más sutil.
    // freq: Cambia la frecuencia del patrón de deformación (más alto = más ondulaciones).
    // speed: Cambia la velocidad de la animación de la deformación.
    { freq: 3.8, amp: 10, speed: 0.0011 }, // ← Cambia la expansión con el sonido (amp)
    { freq: 6.5, amp: 2, speed: 0.0008 }, // ← Cambia la expansión con el sonido (amp)
  ],
  ROTATION_ENABLED: true,
  angularAccelerationEase: 0.012, // Más bajo = reacciona más rápido a los cambios de aceleración
  baseMaxTargetAngularAcceleration: 0.00001, // SUBE para que la aceleración base sea mayor (más movimiento incluso sin sonido).DEFAULT: 0.00001
  baseMaxAngularVelocity: 0.002, // SUBE para que la velocidad máxima base sea mayor (más rápido en reposo).DEFAULT: 0.002
  baseAngularDamping: 0.98, // SUBE para que la rotación se frene más rápido (más amortiguación), BAJA para que gire más tiempo.DEFAULT: 0.98
  volumeMultiplierForAngularAcceleration: 10, // SUBE para que la aceleración angular aumente mucho con el sonido, BAJA para menos efecto. DEFAULT: 80.0
  volumeMultiplierForMaxAngularVelocity: 23, // SUBE para que la velocidad máxima aumente mucho con el sonido, BAJA para menos efecto. DEFAULT: 45.0
  volumePowerForRotation: 2.0, // SUBE para que el efecto de la voz sea más explosivo (no lineal), BAJA para que sea más suave. DEFAULT: 2.0
  minTimeForAccelerationChange: 200, // DEFAULT: 200
  randomTimeForAccelerationChange: 400, // DEFAULT: 400
  minParticleSizeFactor: 0.4, // SUBE para que el tamaño mínimo de las partículas sea mayor (no se hagan tan pequeñas), BAJA para más variación. DEFAULT: 0.4
  particleSizeVelocityScale: 0.7, // SUBE para que la velocidad afecte más el tamaño de las partículas, BAJA para menos efecto. DEFAULT: 0.7
  minParticleSize: 0, // Valor por defecto sugerido
  maxParticleSize: 3.2, // Valor por defecto sugerido
  particleBlurFactor: 8, // Valor por defecto sugerido para el blur
  haloCount: 3, // Valor por defecto para número de halos
  haloBaseAlpha: 0.18, // Valor por defecto para opacidad base del halo
};
