// src/components/audio-visualizer/types.ts

// Simple Vec2 class (could be in a separate file or defined here)
export class Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  add(v: Vec2): Vec2 {
    return new Vec2(this.x + v.x, this.y + v.y);
  }
  sub(v: Vec2): Vec2 {
    return new Vec2(this.x - v.x, this.y - v.y);
  }
  mult(s: number): Vec2 {
    return new Vec2(this.x * s, this.y * s);
  }
  div(s: number): Vec2 {
    return s !== 0 ? new Vec2(this.x / s, this.y / s) : new Vec2(0, 0);
  }
  mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  normalize(): Vec2 {
    const m = this.mag();
    return m > 0 ? this.div(m) : new Vec2();
  }
  dist(v: Vec2): number {
    return this.sub(v).mag();
  }
  copy(): Vec2 {
    return new Vec2(this.x, this.y);
  }
  static fromAngle(angle: number, length: number = 1): Vec2 {
    return new Vec2(length * Math.cos(angle), length * Math.sin(angle));
  }
}

export interface Particle {
  id: number;
  // Usamos Vec2 para posición y posición objetivo
  position: Vec2;
  targetPosition: Vec2;

  baseAngle: number;
  virtualLineIndex: number;
  radiusOffset: number;
  // phaseSeed ahora influenciado por ruido, pero sigue siendo un factor
  phaseSeed: number;
  reactivityFactor: number; // La reactividad puede afectar tamaño, rotación, deformación...

  // Propiedades de rotación
  currentAngleOffset: number;
  angularVelocity: number;
  angularAcceleration: number;
  targetAngularAcceleration: number;
  timeToChangeAccelerationTarget: number;

  // Propiedades de Tamaño (Nuevas)
  currentSize: number;
  targetSize: number;

  // Control de reactividad al volumen
  isVolumeReactive: boolean; // Indica si la partícula debe reaccionar al volumen
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
  audioContext?: AudioContext;
  analyser?: AnalyserNode;
}

export interface VisualizerViewProps {
  smoothedVolume: number;
  width: number;
  height: number;
  // Agrupamos los parámetros de configuración visual
  config: VisualizerConfig;
}

export interface VisualizerConfig {
  particleColor: string;
  baseParticleSize: number; // This might become less relevant with min/max

  numVirtualLines: number;
  particlesPerLine: number;
  easeFactor: number; // Easing para la posición
  lineSpacingVariation: number;
  baseRadiusFactor: number;

  // Parámetros de deformación estática (usando senos/cosenos)
  staticDeformParams: { freq: number; amp: number; speed: number }[];
  // Parámetros de deformación por volumen (usando senos/cosenos)
  volumeDeformParams: { freq: number; amp: number; speed: number }[];

  // Parámetros de Deformación basados en Ruido
  noiseDeformationParams: {
    staticNoiseAmp: number;
    staticNoiseScale: number;
    staticNoiseSpeed: number;
    volumeNoiseAmp: number;
    volumeNoiseScale: number;
    volumeNoiseSpeed: number;
  }[];

  // Parámetros de Rotación
  ROTATION_ENABLED: boolean;
  angularAccelerationEase: number;
  baseMaxTargetAngularAcceleration: number;
  baseMaxAngularVelocity: number;
  baseAngularDamping: number;
  volumeMultiplierForAngularAcceleration: number;
  volumeMultiplierForMaxAngularVelocity: number;
  volumePowerForRotation: number; // Potencia aplicada al volumen para la ROTACIÓN
  minTimeForAccelerationChange: number;
  randomTimeForAccelerationChange: number;
  noiseRotationScale: number;
  noiseRotationSpeed: number;
  noiseRotationAmp: number;

  // Variación de tamaño de partícula (Mejorada)
  minParticleSizeFactor: number; // Maybe less useful now
  particleSizeVelocityScale: number; // Aún puede usarse para reducir tamaño con velocidad
  minParticleSize: number; // Tamaño mínimo absoluto
  maxParticleSize: number; // Tamaño máximo absoluto

  // Nuevos parámetros para el cálculo de tamaño según volumen y ruido
  volumeSizePower: number; // Potencia aplicada al volumen para el TAMAÑO (más alto = más explosivo)
  sizeEaseFactor: number; // Easing para el TAMAÑO (más bajo = cambio de tamaño más lento)
  noiseSizeScale: number; // Escala espacial del ruido para el tamaño
  noiseSizeSpeed: number; // Velocidad temporal del ruido para el tamaño
  noiseSizeAmp: number; // Amplitud del ruido que modula el tamaño (afecta la variación relativa). 0 = sin modulación por ruido.

  // Parámetros de apariencia (Halos/Blur)
  particleBlurFactor: number; // Factor de difuminado (escalado de halos)
  haloCount?: number;
  haloBaseAlpha?: number;

  // Control de reactividad al volumen
  volumeReactivePercentage: number; // Porcentaje de partículas que reaccionan al volumen (0-1)
}

export const DEFAULT_VISUALIZER_CONFIG: VisualizerConfig = {
  particleColor: "#f0f0f0",
  numVirtualLines: 6,
  particlesPerLine: 90,
  easeFactor: 0.09, // Easing para POSICION
  lineSpacingVariation: 2.2,
  baseRadiusFactor: 0.26,
  staticDeformParams: [
    { freq: 4.5, amp: 2.5, speed: 0.0005 },
    { freq: 7.2, amp: 2.0, speed: 0.0003 },
  ],
  baseParticleSize: 1.2, // Keep for backward compatibility/reference

  volumeDeformParams: [
    { freq: 3.8, amp: 10, speed: 0.0011 },
    { freq: 6.5, amp: 2, speed: 0.0008 },
  ],

  noiseDeformationParams: [
    {
      staticNoiseAmp: 5,
      staticNoiseScale: 0.008,
      staticNoiseSpeed: 0.0002,
      volumeNoiseAmp: 15,
      volumeNoiseScale: 0.01,
      volumeNoiseSpeed: 0.0005,
    },
    {
      staticNoiseAmp: 1,
      staticNoiseScale: 0.05,
      staticNoiseSpeed: 0.0008,
      volumeNoiseAmp: 3,
      volumeNoiseScale: 0.08,
      volumeNoiseSpeed: 0.001,
    },
  ],

  ROTATION_ENABLED: true,
  angularAccelerationEase: 0.012,
  baseMaxTargetAngularAcceleration: 0.00001,
  baseMaxAngularVelocity: 0.002,
  baseAngularDamping: 0.98,
  volumeMultiplierForAngularAcceleration: 80.0,
  volumeMultiplierForMaxAngularVelocity: 45.0,
  volumePowerForRotation: 2.0, // Potencia para ROTACION
  minTimeForAccelerationChange: 200,
  randomTimeForAccelerationChange: 400,
  noiseRotationScale: 0.01,
  noiseRotationSpeed: 0.0001,
  noiseRotationAmp: 0.00003,

  minParticleSizeFactor: 0.4, // Maybe less useful now
  particleSizeVelocityScale: 0.7,
  minParticleSize: 0.5,
  maxParticleSize: 3.2,

  // --- Nuevos parámetros de TAMAÑO ---
  volumeSizePower: 3.0, // **Potencia alta para que el tamaño sea muy reactivo a picos de volumen**
  sizeEaseFactor: 0.15, // **Easing para TAMAÑO** (más rápido que el de posición)
  noiseSizeScale: 0.05, // Escala espacial del ruido que modula el tamaño. Más bajo = cambios suaves entre partículas.
  noiseSizeSpeed: 0.001, // Velocidad temporal del ruido que modula el tamaño.
  noiseSizeAmp: 0.5, // Amplitud del ruido que modula el tamaño (afecta la variación relativa). 0 = sin modulación por ruido.

  particleBlurFactor: 8,
  haloCount: 3,
  haloBaseAlpha: 0.18,

  volumeReactivePercentage: 0.1, // 10% de las partículas reaccionarán al volumen
};
