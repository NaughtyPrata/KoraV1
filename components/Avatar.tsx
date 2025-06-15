import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { AvatarData, loadAvatar, generateRandomAvatarId } from '@/lib/readyplayerme';
import { LipSyncController } from '@/utils/lipSync';

// Background component - will load image when available
function Background() {
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  
  useEffect(() => {
    console.log('Background: Starting to load texture...');
    const loader = new THREE.TextureLoader();
    loader.load(
      '/images/background.png',
      (loadedTexture) => {
        console.log('Background: Texture loaded successfully!', loadedTexture);
        setTexture(loadedTexture);
      },
      (progress) => {
        console.log('Background: Loading progress:', progress);
      },
      (error) => {
        console.error('Background: Image failed to load:', error);
        console.log('Background: Creating fallback texture...');
        // Create a simple colored background as fallback
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ff0000'; // Make it red so we can see if fallback is working
          ctx.fillRect(0, 0, 512, 512);
          const fallbackTexture = new THREE.CanvasTexture(canvas);
          console.log('Background: Fallback texture created:', fallbackTexture);
          setTexture(fallbackTexture);
        }
      }
    );
  }, []);
  
  return (
    <mesh position={[0, 1.71, -1.5]} scale={[2.96, 1.48, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} color={texture ? 'white' : '#f0f0f0'} />
    </mesh>
  );
}

// Static camera controller - no movement
function CameraController() {
  return (
    <PerspectiveCamera
      makeDefault
      position={[0, 1.7, 0.8]}
      fov={35}
    />
  );
}

interface AvatarProps {
  avatarId?: string;
  isPlaying: boolean;
  audioElement: HTMLAudioElement | null;
  emotion?: string;
  onAvatarLoaded?: (avatarData: AvatarData) => void;
}

function AvatarModel({ avatarId, isPlaying, audioElement, emotion = 'neutral', onAvatarLoaded }: AvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [avatarData, setAvatarData] = useState<AvatarData | null>(null);
  const [lipSyncController, setLipSyncController] = useState<LipSyncController | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Animation states
  const [idleAnimation, setIdleAnimation] = useState<THREE.AnimationAction | null>(null);
  
  // Blinking states
  const [nextBlinkTime, setNextBlinkTime] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkStartTime, setBlinkStartTime] = useState(0);

  // Blinking function
  const applyBlink = useCallback((blinkAmount: number) => {
    if (!avatarData) return;

    let foundBlinkTargets = false;
    
    avatarData.scene.traverse((child) => {
      if (child instanceof THREE.SkinnedMesh && child.morphTargetInfluences && child.morphTargetDictionary) {
        // Try different possible eye blink morph target names
        const eyeBlinkTargets = [
          'eyeBlink_L', 'eyeBlink_R',
          'eyesClosed', 'eyesClose',
          'blink_L', 'blink_R',
          'eyeLid_L', 'eyeLid_R',
          'eyeClose_L', 'eyeClose_R',
          'eyeBlinkLeft', 'eyeBlinkRight',
          'EyeBlink_L', 'EyeBlink_R',
          'Eye_Blink_Left', 'Eye_Blink_Right',
          'viseme_blink', 'blink',
          'eyeLidClose_L', 'eyeLidClose_R'
        ];

        eyeBlinkTargets.forEach(targetName => {
          const index = child.morphTargetDictionary?.[targetName];
          if (index !== undefined && child.morphTargetInfluences) {
            child.morphTargetInfluences[index] = blinkAmount;
            foundBlinkTargets = true;
          }
        });
      }
    });

    if (!foundBlinkTargets && blinkAmount > 0) {
      // Fallback for geometric avatar
      const avatarParts = (avatarData.scene as any).avatarParts;
      if (avatarParts && avatarParts.leftEye && avatarParts.rightEye) {
        avatarParts.leftEye.scale.y = 1 - (blinkAmount * 0.8);
        avatarParts.rightEye.scale.y = 1 - (blinkAmount * 0.8);
      }
    }
  }, [avatarData]);

  // Generate random blink timing
  const getNextBlinkDelay = useCallback(() => {
    // Random blink every 2-6 seconds
    return 2000 + Math.random() * 4000;
  }, []);

  // Fast double blink function
  const triggerDoubleBlink = useCallback(() => {
    const currentTime = Date.now();
    
    // First blink
    setIsBlinking(true);
    setBlinkStartTime(currentTime);
    
    // Schedule second blink after first one completes
    setTimeout(() => {
      setIsBlinking(true);
      setBlinkStartTime(Date.now());
    }, 200); // 200ms delay between blinks
    
    // Reset normal blinking schedule after double blink
    setTimeout(() => {
      setNextBlinkTime(Date.now() + getNextBlinkDelay());
    }, 500);
  }, [getNextBlinkDelay]);

  // Load avatar
  useEffect(() => {
    const loadAvatarModel = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const id = avatarId || generateRandomAvatarId();
        console.log('Loading avatar:', {
          providedAvatarId: avatarId,
          generatedId: id,
          usingProvidedId: !!avatarId,
          envVarFromProps: process.env.READYPLAYERME_AVATAR_URL
        });
        
        const data = await loadAvatar(id, {
          quality: 'medium',
          morphTargets: true,
          pose: 'A'
        });

        setAvatarData(data);
        
        // Initialize lip sync controller
        const controller = new LipSyncController(data);
        await controller.initialize();
        setLipSyncController(controller);

        // Setup idle animation
        if (data.animations.length > 0) {
          const idle = data.mixer.clipAction(data.animations[0]);
          idle.play();
          setIdleAnimation(idle);
        }

        // Initialize first blink timing
        setNextBlinkTime(Date.now() + getNextBlinkDelay());

        onAvatarLoaded?.(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to load avatar:', err);
        setError('Failed to load avatar. Please try again.');
        setIsLoading(false);
      }
    };

    loadAvatarModel();

    return () => {
      lipSyncController?.dispose();
    };
  }, [avatarId, onAvatarLoaded, getNextBlinkDelay]);

  // Handle audio playback and lip sync
  useEffect(() => {
    if (!lipSyncController || !audioElement) return;

    if (isPlaying) {
      lipSyncController.startLipSync(audioElement);
    } else {
      lipSyncController.stopLipSync();
    }

    return () => {
      lipSyncController.stopLipSync();
    };
  }, [isPlaying, audioElement, lipSyncController]);

  // Animation loop
  useFrame((state, delta) => {
    if (avatarData) {
      avatarData.mixer.update(delta);
      
      const currentTime = Date.now();
      
      // Handle blinking
      if (!isBlinking && currentTime >= nextBlinkTime) {
        // 20% chance for double blink, 80% chance for single blink
        if (Math.random() < 0.2) {
          triggerDoubleBlink();
        } else {
          // Start a normal single blink
          setIsBlinking(true);
          setBlinkStartTime(currentTime);
        }
      }
      
      if (isBlinking) {
        const blinkDuration = 150; // Blink duration in milliseconds
        const blinkProgress = (currentTime - blinkStartTime) / blinkDuration;
        
        if (blinkProgress >= 1) {
          // End blink
          setIsBlinking(false);
          setNextBlinkTime(currentTime + getNextBlinkDelay());
          applyBlink(0); // Eyes open
        } else {
          // Animate blink - use sine wave for smooth open/close
          const blinkAmount = Math.sin(blinkProgress * Math.PI);
          applyBlink(blinkAmount);
        }
      }
      
      // Add subtle head movement and gentle breathing
      if (groupRef.current) {
        const time = state.clock.elapsedTime;
        
        // Very subtle breathing animation (much gentler than before)
        groupRef.current.scale.y = 1 + Math.sin(time * 0.8) * 0.001;
        
        // Subtle natural head movements - always apply base tilt, reduce movement when speaking
        if (avatarData.scene) {
          // Traverse the scene to find head-related bones
          avatarData.scene.traverse((child: any) => {
            if (child.isBone && child.name) {
              // Look for common head bone names
              const name = child.name.toLowerCase();
              if (name.includes('head') || name.includes('neck') || name.includes('skull')) {
                // Base upward tilt (always applied)
                const baseTiltX = 0.10;
                
                // Subtle movements (reduced when speaking)
                const movementScale = isPlaying ? 0.3 : 1.0; // Reduce movement when speaking
                const randomY = -(Math.sin(time * 0.3) + Math.sin(time * 0.7) * 0.3) * 0.02 * movementScale;
                const randomX = -(Math.sin(time * 0.2) + Math.sin(time * 0.5) * 0.4) * 0.01 * movementScale;
                const randomZ = -Math.sin(time * 0.4) * 0.008 * movementScale;
                
                child.rotation.y = randomY;
                child.rotation.x = baseTiltX + randomX; // Always apply base tilt
                child.rotation.z = randomZ;
              }
            }
          });
        }
      }
    }
  });

  if (isLoading) {
    return (
      <mesh>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color="#666" wireframe />
      </mesh>
    );
  }

  if (error || !avatarData) {
    return (
      <mesh>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color="#ff0000" />
      </mesh>
    );
  }

  return (
    <group ref={groupRef}>
      <primitive object={avatarData.scene} />
    </group>
  );
}

export default function Avatar(props: AvatarProps) {
  return (
    <Canvas
      style={{ width: '100%', height: '100%' }}
      gl={{ antialias: true, alpha: true }}
      dpr={[1, 2]}
    >
      {/* Default lighting with dramatic side light */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1} />
      
      {/* Balanced asymmetric side lights - left side less dark */}
      <pointLight position={[-0.8, 1.8, 0.5]} intensity={0.5} color="#ffffff" />
      <pointLight position={[0.8, 1.8, 0.5]} intensity={2.0} color="#ffffff" />

      {/* Camera - Close-up head shot with slow movement */}
      <CameraController />

      {/* Background */}
      <Background />

      {/* Avatar - Positioned lower in the viewport */}
      <group position={[0, 0.1, 0]}>
        <AvatarModel {...props} />
      </group>


    </Canvas>
  );
} 