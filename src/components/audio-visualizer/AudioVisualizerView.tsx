// src/components/audio-visualizer/AudioVisualizerView.tsx
import React, { useRef, useEffect, useCallback } from "react";
// Importa Vec2 desde types.ts
import type { Particle, VisualizerViewProps, VisualizerConfig } from "./types";
import { DEFAULT_VISUALIZER_CONFIG, Vec2 } from "./types";
import { noise2D, noise3D } from "../../utils/perLinNoise";
// Importa las funciones vanilla noise desde el archivo utilitario

const AudioVisualizerView: React.FC<VisualizerViewProps> = ({
  smoothedVolume,
  width,
  height,
  config = DEFAULT_VISUALIZER_CONFIG,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const timeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);

  const {
    particleColor,
    // baseParticleSize, // Ya no es el principal para el cálculo de tamaño
    numVirtualLines,
    particlesPerLine,
    easeFactor, // Easing para posición
    lineSpacingVariation,
    baseRadiusFactor,
    staticDeformParams,
    volumeDeformParams,
    noiseDeformationParams,
    ROTATION_ENABLED,
    angularAccelerationEase,
    baseMaxTargetAngularAcceleration,
    baseMaxAngularVelocity,
    baseAngularDamping,
    volumeMultiplierForAngularAcceleration,
    volumeMultiplierForMaxAngularVelocity,
    volumePowerForRotation, // Potencia para Rotación
    minTimeForAccelerationChange,
    randomTimeForAccelerationChange,
    noiseRotationScale,
    noiseRotationSpeed,
    noiseRotationAmp,
    // minParticleSizeFactor, // Ya no es el principal para el cálculo de tamaño
    particleSizeVelocityScale,
    minParticleSize, // Tamaño mínimo absoluto
    maxParticleSize, // Tamaño máximo absoluto
    // Nuevos parámetros de tamaño
    volumeSizePower, // Potencia para Tamaño
    sizeEaseFactor, // Easing para Tamaño
    noiseSizeScale,
    noiseSizeSpeed,
    noiseSizeAmp,
    // Parámetros de apariencia
    particleBlurFactor,
    haloCount,
    haloBaseAlpha,
  } = config;

  const totalParticles = numVirtualLines * particlesPerLine;

  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * baseRadiusFactor;
  const centerVec = new Vec2(centerX, centerY);

  const createParticle = useCallback(
    (index: number): Particle => {
      const virtualLineIndex = Math.floor(index / particlesPerLine);
      const angle =
        ((index % particlesPerLine) / particlesPerLine) * Math.PI * 2;
      const radiusOffsetForLine =
        (virtualLineIndex - (numVirtualLines - 1) / 2) * lineSpacingVariation;
      const reactivity = 0.6 + Math.random() * 1.1;

      const noisePhase = noise2D(index * 0.01, virtualLineIndex * 0.1);
      const phaseSeed = noisePhase * Math.PI;

      const initialTimeToChangeTarget =
        timeRef.current +
        minTimeForAccelerationChange +
        Math.floor(Math.random() * randomTimeForAccelerationChange);

      const initialPosition = new Vec2(
        centerX + (Math.random() - 0.5) * 30,
        centerY + (Math.random() - 0.5) * 30
      );

      // Inicializar currentSize y targetSize al mínimo para empezar pequeño
      const initialSize = minParticleSize;

      // Determinar si la partícula debe reaccionar al volumen basado en el porcentaje configurado
      const isVolumeReactive = Math.random() < config.volumeReactivePercentage;

      return {
        id: index,
        position: initialPosition,
        targetPosition: new Vec2(centerX, centerY),
        baseAngle: angle,
        virtualLineIndex: virtualLineIndex,
        radiusOffset: radiusOffsetForLine,
        phaseSeed: phaseSeed,
        reactivityFactor: reactivity,
        currentAngleOffset: (Math.random() - 0.5) * 0.05,
        angularVelocity: 0,
        angularAcceleration: 0,
        targetAngularAcceleration: 0,
        timeToChangeAccelerationTarget: initialTimeToChangeTarget,
        // Propiedades de Tamaño
        currentSize: initialSize, // Empezamos con tamaño mínimo
        targetSize: initialSize, // Target inicial es también el mínimo
        isVolumeReactive: isVolumeReactive,
      };
    },
    [
      centerX,
      centerY,
      particlesPerLine,
      numVirtualLines,
      lineSpacingVariation,
      minTimeForAccelerationChange,
      randomTimeForAccelerationChange,
      minParticleSize, // Añadido como dependencia ya que se usa para initialSize
      config.volumeReactivePercentage,
      // noise2D is imported, not a direct dependency here
    ]
  );

  const initParticles = useCallback(() => {
    const newParticles = [];
    for (let i = 0; i < totalParticles; i++) {
      newParticles.push(createParticle(i));
    }
    particlesRef.current = newParticles;
  }, [totalParticles, createParticle]);

  const updateAndDrawParticles = useCallback(
    (ctx: CanvasRenderingContext2D, currentSmoothedVolume: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = particleColor;

      const volumeFactor = Math.max(0, Math.min(currentSmoothedVolume, 1.0));
      const volumeFactorForRotation = Math.pow(
        volumeFactor,
        volumePowerForRotation
      );
      // Factor de volumen elevado a la potencia para el TAMAÑO
      const volumeFactorForSize = Math.pow(volumeFactor, volumeSizePower);

      particlesRef.current.forEach((p) => {
        const particleReactivity = p.reactivityFactor;

        // --- Lógica de Rotación (igual que antes) ---
        let particleCurrentMaxTargetAcc,
          particleCurrentMaxAngVel,
          particleCurrentDamping;

        if (volumeFactorForRotation > 0.01) {
          particleCurrentMaxTargetAcc =
            baseMaxTargetAngularAcceleration *
            volumeMultiplierForAngularAcceleration *
            particleReactivity *
            volumeFactorForRotation;
          particleCurrentMaxAngVel =
            baseMaxAngularVelocity *
            volumeMultiplierForMaxAngularVelocity *
            particleReactivity *
            volumeFactorForRotation;
          particleCurrentDamping = 0.99;
        } else {
          particleCurrentMaxTargetAcc =
            baseMaxTargetAngularAcceleration * particleReactivity;
          particleCurrentMaxAngVel =
            baseMaxAngularVelocity * particleReactivity;
          particleCurrentDamping = baseAngularDamping;
        }

        let particleAngle = p.baseAngle;

        if (ROTATION_ENABLED) {
          if (volumeFactorForRotation <= 0.01) {
            if (timeRef.current >= p.timeToChangeAccelerationTarget) {
              const noiseAcc = noise3D(
                p.id * noiseRotationScale,
                p.virtualLineIndex * noiseRotationScale * 2,
                timeRef.current * noiseRotationSpeed
              );
              p.targetAngularAcceleration =
                noiseAcc * noiseRotationAmp * particleReactivity;

              p.timeToChangeAccelerationTarget =
                timeRef.current +
                minTimeForAccelerationChange +
                Math.floor(Math.random() * randomTimeForAccelerationChange);
            }
          } else {
            p.targetAngularAcceleration =
              (p.id % 2 === 0 ? 1 : -1) *
              particleCurrentMaxTargetAcc *
              (0.5 + Math.random() * 0.5);
          }

          p.angularAcceleration +=
            (p.targetAngularAcceleration - p.angularAcceleration) *
            angularAccelerationEase;
          p.angularVelocity += p.angularAcceleration;
          p.angularVelocity *= particleCurrentDamping;
          p.angularVelocity = Math.max(
            -particleCurrentMaxAngVel,
            Math.min(particleCurrentMaxAngVel, p.angularVelocity)
          );

          p.currentAngleOffset += p.angularVelocity;
          particleAngle += p.currentAngleOffset;
        }

        // --- Lógica de Deformación Radial (igual que antes) ---
        const cosA = Math.cos(particleAngle);
        const sinA = Math.sin(particleAngle);

        let radiusDeformation = 0;

        staticDeformParams.forEach((param, idx) => {
          const phase =
            p.phaseSeed +
            p.virtualLineIndex * (idx + 0.7) +
            timeRef.current * param.speed;
          radiusDeformation +=
            (idx % 2 === 0
              ? Math.sin(particleAngle * param.freq + phase)
              : Math.cos(particleAngle * param.freq + phase)) * param.amp;
        });

        let volumeSpecificSinusoidDeformation = 0;
        if (currentSmoothedVolume > 0.015) {
          volumeDeformParams.forEach((param, idx) => {
            const phase =
              p.phaseSeed +
              p.virtualLineIndex * (idx + 0.9) +
              timeRef.current * param.speed * (1 + currentSmoothedVolume * 1.2);
            volumeSpecificSinusoidDeformation +=
              (idx % 2 === 0
                ? Math.sin(particleAngle * param.freq + phase)
                : Math.cos(particleAngle * param.freq + phase)) * param.amp;
          });
          radiusDeformation +=
            currentSmoothedVolume *
            volumeSpecificSinusoidDeformation *
            particleReactivity;
        }

        let noiseDeformationAmount = 0;
        noiseDeformationParams.forEach((param) => {
          const noiseCoord1 = p.baseAngle * param.staticNoiseScale;
          const noiseCoord2 = timeRef.current * param.staticNoiseSpeed;
          const staticNoise = noise2D(noiseCoord1, noiseCoord2);

          const volumeNoiseCoord1 = p.baseAngle * param.volumeNoiseScale;
          const volumeNoiseCoord2 =
            timeRef.current * param.volumeNoiseSpeed * (1 + volumeFactor * 0.5);
          const volumeNoise = noise2D(volumeNoiseCoord1, volumeNoiseCoord2);

          const mappedStaticNoise = staticNoise;
          const mappedVolumeNoise = volumeNoise;

          noiseDeformationAmount += mappedStaticNoise * param.staticNoiseAmp;
          noiseDeformationAmount +=
            mappedVolumeNoise *
            param.volumeNoiseAmp *
            volumeFactor *
            particleReactivity;
        });

        radiusDeformation += noiseDeformationAmount;

        const currentParticleBaseRadius = baseRadius + p.radiusOffset;
        const targetRadius = currentParticleBaseRadius + radiusDeformation;

        const targetVec = Vec2.fromAngle(particleAngle, targetRadius);
        p.targetPosition = centerVec.add(targetVec);

        const toTarget = p.targetPosition.sub(p.position);
        p.position = p.position.add(toTarget.mult(easeFactor));

        // --- NUEVA LÓGICA DE TAMAÑO ---

        // Actualizar el tamaño solo si la partícula es reactiva al volumen
        if (p.isVolumeReactive) {
          const noiseSize = noise3D(
            p.position.x * noiseSizeScale,
            p.position.y * noiseSizeScale,
            timeRef.current * noiseSizeSpeed
          );

          const noiseSizeFactor = 1 + noiseSize * noiseSizeAmp;
          const targetSize =
            minParticleSize +
            (maxParticleSize - minParticleSize) *
              volumeFactorForSize *
              noiseSizeFactor;

          p.targetSize = targetSize;
          p.currentSize += (p.targetSize - p.currentSize) * sizeEaseFactor;
        } else {
          // Si no es reactiva al volumen, mantener un tamaño constante
          p.currentSize = minParticleSize;
          p.targetSize = minParticleSize;
        }

        // --- Dibujar (usando currentSize) ---
        const finalHaloCount = haloCount ?? 3;
        const finalHaloBaseAlpha = haloBaseAlpha ?? 0.18;

        for (let h = finalHaloCount; h >= 1; h--) {
          // Escalar los halos usando el p.currentSize actual
          const haloRadius =
            p.currentSize *
            (1 +
              (finalHaloCount - h + 1) *
                (particleBlurFactor / finalHaloCount / 10));
          ctx.globalAlpha = finalHaloBaseAlpha * (h / finalHaloCount);
          ctx.beginPath();
          ctx.arc(p.position.x, p.position.y, haloRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        // Dibujar la partícula principal con opacidad total
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        // Usar p.currentSize
        ctx.arc(p.position.x, p.position.y, p.currentSize, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    [
      width,
      height,
      centerVec,
      baseRadius,
      particleColor,
      easeFactor,
      staticDeformParams,
      volumeDeformParams,
      noiseDeformationParams,
      ROTATION_ENABLED,
      angularAccelerationEase,
      baseMaxTargetAngularAcceleration,
      baseMaxAngularVelocity,
      baseAngularDamping,
      volumeMultiplierForAngularAcceleration,
      volumeMultiplierForMaxAngularVelocity,
      volumePowerForRotation,
      minTimeForAccelerationChange,
      randomTimeForAccelerationChange,
      noiseRotationScale,
      noiseRotationSpeed,
      noiseRotationAmp,
      particleSizeVelocityScale,
      minParticleSize,
      maxParticleSize,
      // Nuevos parámetros de tamaño en dependencias
      volumeSizePower,
      sizeEaseFactor,
      noiseSizeScale,
      noiseSizeSpeed,
      noiseSizeAmp,
      // Parámetros de apariencia en dependencias
      particleBlurFactor,
      haloCount,
      haloBaseAlpha,
      config.volumeReactivePercentage,
      // noise2D and noise3D are imported vanilla functions, not dependencies needed here
    ]
  );

  // Initialize particles on mount or when config changes
  useEffect(() => {
    timeRef.current = 0;
    initParticles();
  }, [initParticles]);

  // Animation loop effect
  useEffect(() => {
    let frameId: number | null = null;

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      updateAndDrawParticles(ctx, smoothedVolume);

      timeRef.current++;
      animationFrameIdRef.current = requestAnimationFrame(loop);
    };

    animationFrameIdRef.current = requestAnimationFrame(loop);

    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [smoothedVolume, updateAndDrawParticles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
      // Re-initialize particles because center and radius change
      initParticles();
    }
  }, [width, height, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: "block" }}
    />
  );
};

export default AudioVisualizerView;
