// src/components/audio-visualizer/AudioVisualizerView.tsx
import React, { useRef, useEffect, useCallback } from "react";
import type { Particle, VisualizerViewProps, VisualizerConfig } from "./types";
import { DEFAULT_VISUALIZER_CONFIG } from "./types";

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
    baseParticleSize,
    numVirtualLines,
    particlesPerLine,
    easeFactor,
    lineSpacingVariation,
    baseRadiusFactor,
    staticDeformParams,
    volumeDeformParams,
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
    minParticleSizeFactor,
    particleSizeVelocityScale,
    minParticleSize,
    maxParticleSize,
    particleBlurFactor,
  } = config;

  const totalParticles = numVirtualLines * particlesPerLine;

  // Estas dependencias se recalculan si width o height cambian
  const centerX = width / 2;
  const centerY = height / 2;
  const baseRadius = Math.min(width, height) * baseRadiusFactor;

  const createParticle = useCallback(
    (index: number): Particle => {
      const virtualLineIndex = Math.floor(index / particlesPerLine);
      const angle =
        ((index % particlesPerLine) / particlesPerLine) * Math.PI * 2;
      const radiusOffsetForLine =
        (virtualLineIndex - (numVirtualLines - 1) / 2) * lineSpacingVariation;
      const reactivity = 0.6 + Math.random() * 1.1;

      const initialTimeToChangeTarget =
        timeRef.current +
        minTimeForAccelerationChange +
        Math.floor(Math.random() * randomTimeForAccelerationChange);

      return {
        id: index,
        x: centerX + (Math.random() - 0.5) * 30,
        y: centerY + (Math.random() - 0.5) * 30,
        targetX: centerX,
        targetY: centerY,
        baseAngle: angle,
        virtualLineIndex: virtualLineIndex,
        radiusOffset: radiusOffsetForLine,
        phaseSeed: Math.random() * Math.PI * 2,
        reactivityFactor: reactivity,
        currentAngleOffset: (Math.random() - 0.5) * 0.05,
        angularVelocity: 0,
        angularAcceleration: 0,
        targetAngularAcceleration: 0,
        timeToChangeAccelerationTarget: initialTimeToChangeTarget,
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

      const volumeFactorForRotation = Math.pow(
        Math.max(0, Math.min(currentSmoothedVolume, 1.0)),
        volumePowerForRotation
      );

      particlesRef.current.forEach((p) => {
        const particleReactivity = p.reactivityFactor;

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
          if (
            timeRef.current >= p.timeToChangeAccelerationTarget &&
            volumeFactorForRotation <= 0.01
          ) {
            p.targetAngularAcceleration =
              (Math.random() - 0.5) * 2 * particleCurrentMaxTargetAcc;
            p.timeToChangeAccelerationTarget =
              timeRef.current +
              minTimeForAccelerationChange +
              Math.floor(Math.random() * randomTimeForAccelerationChange);
          } else if (volumeFactorForRotation > 0.01) {
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

        let volumeSpecificDeformationAmount = 0;
        if (currentSmoothedVolume > 0.015) {
          volumeDeformParams.forEach((param, idx) => {
            const phase =
              p.phaseSeed +
              p.virtualLineIndex * (idx + 0.9) +
              timeRef.current * param.speed * (1 + currentSmoothedVolume * 1.2);
            volumeSpecificDeformationAmount +=
              (idx % 2 === 0
                ? Math.sin(particleAngle * param.freq + phase)
                : Math.cos(particleAngle * param.freq + phase)) * param.amp;
          });
          radiusDeformation +=
            currentSmoothedVolume *
            volumeSpecificDeformationAmount *
            particleReactivity;
        }

        const currentParticleBaseRadius = baseRadius + p.radiusOffset;
        const targetRadius = currentParticleBaseRadius + radiusDeformation;

        p.targetX = centerX + targetRadius * cosA;
        p.targetY = centerY + targetRadius * sinA;

        p.x += (p.targetX - p.x) * easeFactor;
        p.y += (p.targetY - p.y) * easeFactor;

        // Nuevo cálculo de tamaño de partícula aleatorio entre min y max, escalado por volumen
        const vol = Math.max(0, Math.min(currentSmoothedVolume, 1));
        const randomFactor = Math.pow(Math.random(), 2.5);
        let currentParticleSize =
          minParticleSize +
          (maxParticleSize - minParticleSize) * randomFactor * vol;
        // Si quieres que siempre haya al menos minSize, pero el rango crezca con el volumen:
        // let currentParticleSize = minSize + (maxSize - minSize) * vol * randomFactor;

        if (
          ROTATION_ENABLED &&
          particleCurrentMaxAngVel > baseMaxAngularVelocity * 2
        ) {
          const speedRatio = Math.min(
            1,
            Math.abs(p.angularVelocity) / (particleCurrentMaxAngVel * 0.5)
          );
          baseParticleSize * (1 - speedRatio * particleSizeVelocityScale);

          currentParticleSize = Math.max(
            baseParticleSize * minParticleSizeFactor,
            currentParticleSize
          );
        }

        // Dibujar varias circunferencias concéntricas para simular difuminado
        const haloCount = config.haloCount ?? 3; // Número de halos configurable
        const baseAlpha = config.haloBaseAlpha ?? 0.18; // Opacidad base configurable
        for (let h = haloCount; h >= 1; h--) {
          const haloRadius = currentParticleSize * (1 + h * 0.45);
          ctx.globalAlpha = baseAlpha * (h / haloCount);
          ctx.beginPath();
          ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1.0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, currentParticleSize, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    [
      width,
      height,
      centerX,
      centerY,
      baseRadius,
      particleColor,
      easeFactor,
      baseParticleSize,
      staticDeformParams,
      volumeDeformParams,
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
      minParticleSizeFactor,
      particleSizeVelocityScale,
      minParticleSize,
      maxParticleSize,
      particleBlurFactor,
    ]
  );

  useEffect(() => {
    timeRef.current = 0;
    initParticles();
  }, [initParticles]);

  useEffect(() => {
    let frameId: number | null = null;

    const loop = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      updateAndDrawParticles(ctx, smoothedVolume);

      timeRef.current++;
      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    return () => {
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [smoothedVolume, updateAndDrawParticles, width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      // Se ajusta el tamaño del canvas desde el componente padre que maneja el layout
      // Aquí no necesitamos el listener de resize si width/height son props
      // Si necesitaras un resize interno, lo pondrías aquí
    }
  }, [width, height]);

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
