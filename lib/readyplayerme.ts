import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

export interface AvatarConfig {
  quality: 'low' | 'medium' | 'high';
  pose: 'A' | 'T';
  morphTargets: boolean;
  textureAtlas: boolean;
  useDracoCompression: boolean;
}

export interface MorphTarget {
  name: string;
  value: number;
}

export interface AvatarData {
  scene: THREE.Group;
  animations: THREE.AnimationClip[];
  mixer: THREE.AnimationMixer;
  morphTargets: { [key: string]: number };
  head: THREE.Object3D | null;
  skeleton: THREE.Skeleton | null;
}

const DEFAULT_CONFIG: AvatarConfig = {
  quality: 'medium',
  pose: 'A',
  morphTargets: true,
  textureAtlas: true,
  useDracoCompression: true
};

// ReadyPlayerMe API configuration
const RPM_BASE_URL = 'https://models.readyplayer.me';
const RPM_SUBDOMAIN = process.env.READYPLAYERME_SUBDOMAIN || 'https://kora.readyplayer.me/avatar';

export function buildAvatarUrl(avatarId: string, config: Partial<AvatarConfig> = {}): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const params = new URLSearchParams();

  // Quality settings
  if (finalConfig.quality === 'low') {
    params.append('lod', '1');
  } else if (finalConfig.quality === 'high') {
    params.append('lod', '0');
  }

  // Pose
  params.append('pose', finalConfig.pose);

  // Morph targets for facial animation
  if (finalConfig.morphTargets) {
    params.append('morphTargets', 'ARKit,Oculus Visemes');
  }

  // Texture atlas for better performance
  if (finalConfig.textureAtlas) {
    params.append('textureAtlas', '1024');
  }

  // Compression
  if (finalConfig.useDracoCompression) {
    params.append('useDracoMeshCompression', 'true');
  }

  return `${RPM_BASE_URL}/${avatarId}.glb?${params.toString()}`;
}

export async function loadAvatar(
  avatarIdOrUrl: string, 
  config: Partial<AvatarConfig> = {}
): Promise<AvatarData> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    
    // Set up DRACOLoader for compressed models
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    dracoLoader.setDecoderConfig({ type: 'js' });
    loader.setDRACOLoader(dracoLoader);
    
    // Determine if input is a direct URL or an avatar ID
    let avatarUrl: string;
    if (avatarIdOrUrl.startsWith('http')) {
      // Direct URL provided
      avatarUrl = avatarIdOrUrl;
      console.log('Loading avatar from direct URL:', avatarUrl);
    } else {
      // Avatar ID provided, build URL
      avatarUrl = buildAvatarUrl(avatarIdOrUrl, config);
      console.log('Loading avatar from ID:', avatarIdOrUrl, 'URL:', avatarUrl);
    }

    loader.load(
      avatarUrl,
      (gltf) => {
        const scene = gltf.scene;
        const animations = gltf.animations;
        const mixer = new THREE.AnimationMixer(scene);

        // Find head bone for head tracking
        let head: THREE.Object3D | null = null;
        let skeleton: THREE.Skeleton | null = null;

        scene.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh) {
            skeleton = child.skeleton;
            // Look for head bone
            skeleton.bones.forEach((bone) => {
              if (bone.name.toLowerCase().includes('head')) {
                head = bone;
              }
            });
          }
        });

        // Extract morph targets for facial animation
        const morphTargets: { [key: string]: number } = {};
        scene.traverse((child) => {
          if (child instanceof THREE.SkinnedMesh && child.morphTargetDictionary) {
            Object.keys(child.morphTargetDictionary).forEach((key) => {
              morphTargets[key] = 0;
            });
          }
        });

        // Clean up DRACOLoader
        dracoLoader.dispose();
        
        resolve({
          scene,
          animations,
          mixer,
          morphTargets,
          head,
          skeleton
        });
      },
      (progress) => {
        console.log('Avatar loading progress:', (progress.loaded / progress.total) * 100 + '%');
      },
      (error) => {
        console.error('Error loading avatar:', error);
        console.log('Falling back to geometric avatar...');
        
        // Clean up DRACOLoader
        dracoLoader.dispose();
        
        // Fallback to geometric avatar if loading fails
        createFallbackAvatar(resolve);
      }
    );
  });
}

// Lip sync morph target mapping for common visemes
export const VISEME_MAPPING: { [key: string]: string[] } = {
  'A': ['viseme_aa'],
  'E': ['viseme_E'],
  'I': ['viseme_I'],
  'O': ['viseme_O'],
  'U': ['viseme_U'],
  'B': ['viseme_PP'],
  'C': ['viseme_kk'],
  'D': ['viseme_DD'],
  'F': ['viseme_FF'],
  'G': ['viseme_kk'],
  'H': ['viseme_I'],
  'K': ['viseme_kk'],
  'L': ['viseme_nn'],
  'M': ['viseme_PP'],
  'N': ['viseme_nn'],
  'P': ['viseme_PP'],
  'Q': ['viseme_kk'],
  'R': ['viseme_RR'],
  'S': ['viseme_sil'],
  'T': ['viseme_DD'],
  'V': ['viseme_FF'],
  'W': ['viseme_U'],
  'X': ['viseme_kk'],
  'Y': ['viseme_I'],
  'Z': ['viseme_sil']
};

export function updateMorphTargets(
  avatarData: AvatarData, 
  morphTargets: { [key: string]: number }
): void {
  avatarData.scene.traverse((child) => {
    if (child instanceof THREE.SkinnedMesh && child.morphTargetInfluences) {
      Object.keys(morphTargets).forEach((targetName) => {
        const index = child.morphTargetDictionary?.[targetName];
        if (index !== undefined && child.morphTargetInfluences) {
          child.morphTargetInfluences[index] = morphTargets[targetName];
        }
      });
    }
  });
}

export function animateToMorphTarget(
  avatarData: AvatarData,
  targetName: string,
  value: number,
  duration: number = 0.1
): void {
  const startValue = avatarData.morphTargets[targetName] || 0;
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / (duration * 1000), 1);
    
    const currentValue = startValue + (value - startValue) * progress;
    avatarData.morphTargets[targetName] = currentValue;
    
    updateMorphTargets(avatarData, { [targetName]: currentValue });

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

// Get avatar ID from environment variable or use default
export function generateRandomAvatarId(): string {
  // Use the correct environment variable that's set in Vercel
  const avatarUrl = process.env.READYPLAYERME_AVATAR_URL || '';
  console.log('generateRandomAvatarId called:', {
    avatarUrl,
    envVar: 'READYPLAYERME_AVATAR_URL',
    hasEnvVar: !!process.env.READYPLAYERME_AVATAR_URL
  });
  return avatarUrl;
}

export function getAvatarCreatorUrl(): string {
  return RPM_SUBDOMAIN;
}

// Create a realistic human-like avatar when ReadyPlayerMe is not available
function createFallbackAvatar(resolve: (value: AvatarData) => void): void {
  const scene = new THREE.Group();
  
  // Create more realistic proportions and materials
  const skinColor = 0xffdbac;
  const hairColor = 0x8b4513;
  const shirtColor = 0x4a90e2;
  const pantsColor = 0x2c3e50;
  
  // Head (more detailed)
  const headGeometry = new THREE.SphereGeometry(0.12, 32, 32);
  const headMaterial = new THREE.MeshStandardMaterial({ 
    color: skinColor,
    roughness: 0.8,
    metalness: 0.1
  });
  const head = new THREE.Mesh(headGeometry, headMaterial);
  head.position.set(0, 1.65, 0);
  head.scale.set(1, 1.1, 0.9); // More human-like head shape
  scene.add(head);
  
  // Hair
  const hairGeometry = new THREE.SphereGeometry(0.13, 16, 16);
  const hairMaterial = new THREE.MeshStandardMaterial({ 
    color: hairColor,
    roughness: 0.9
  });
  const hair = new THREE.Mesh(hairGeometry, hairMaterial);
  hair.position.set(0, 1.7, -0.02);
  hair.scale.set(0.95, 0.8, 0.95);
  scene.add(hair);
  
  // Eyes
  const eyeGeometry = new THREE.SphereGeometry(0.015, 8, 8);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  
  const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  leftEye.position.set(-0.03, 1.67, 0.11);
  scene.add(leftEye);
  
  const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
  rightEye.position.set(0.03, 1.67, 0.11);
  scene.add(rightEye);
  
  // Mouth (will be animated)
  const mouthGeometry = new THREE.SphereGeometry(0.02, 8, 8);
  const mouthMaterial = new THREE.MeshStandardMaterial({ color: 0x8b0000 });
  const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
  mouth.position.set(0, 1.6, 0.11);
  mouth.scale.set(1.5, 0.5, 0.5);
  scene.add(mouth);
  
  // Neck
  const neckGeometry = new THREE.CylinderGeometry(0.06, 0.08, 0.15, 16);
  const neckMaterial = new THREE.MeshStandardMaterial({ color: skinColor });
  const neck = new THREE.Mesh(neckGeometry, neckMaterial);
  neck.position.set(0, 1.5, 0);
  scene.add(neck);
  
  // Torso (more realistic)
  const torsoGeometry = new THREE.CylinderGeometry(0.18, 0.22, 0.6, 16);
  const torsoMaterial = new THREE.MeshStandardMaterial({ 
    color: shirtColor,
    roughness: 0.7
  });
  const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
  torso.position.set(0, 1.1, 0);
  scene.add(torso);
  
  // Arms (more detailed)
  const upperArmGeometry = new THREE.CylinderGeometry(0.04, 0.05, 0.3, 12);
  const lowerArmGeometry = new THREE.CylinderGeometry(0.035, 0.04, 0.25, 12);
  const armMaterial = new THREE.MeshStandardMaterial({ color: skinColor });
  
  // Left arm
  const leftUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
  leftUpperArm.position.set(-0.25, 1.25, 0);
  leftUpperArm.rotation.z = Math.PI / 8;
  scene.add(leftUpperArm);
  
  const leftLowerArm = new THREE.Mesh(lowerArmGeometry, armMaterial);
  leftLowerArm.position.set(-0.35, 1.0, 0);
  leftLowerArm.rotation.z = Math.PI / 6;
  scene.add(leftLowerArm);
  
  // Right arm
  const rightUpperArm = new THREE.Mesh(upperArmGeometry, armMaterial);
  rightUpperArm.position.set(0.25, 1.25, 0);
  rightUpperArm.rotation.z = -Math.PI / 8;
  scene.add(rightUpperArm);
  
  const rightLowerArm = new THREE.Mesh(lowerArmGeometry, armMaterial);
  rightLowerArm.position.set(0.35, 1.0, 0);
  rightLowerArm.rotation.z = -Math.PI / 6;
  scene.add(rightLowerArm);
  
  // Hands
  const handGeometry = new THREE.SphereGeometry(0.04, 12, 12);
  const leftHand = new THREE.Mesh(handGeometry, armMaterial);
  leftHand.position.set(-0.42, 0.85, 0);
  scene.add(leftHand);
  
  const rightHand = new THREE.Mesh(handGeometry, armMaterial);
  rightHand.position.set(0.42, 0.85, 0);
  scene.add(rightHand);
  
  // Legs (more realistic)
  const upperLegGeometry = new THREE.CylinderGeometry(0.08, 0.09, 0.4, 12);
  const lowerLegGeometry = new THREE.CylinderGeometry(0.06, 0.07, 0.35, 12);
  const legMaterial = new THREE.MeshStandardMaterial({ color: pantsColor });
  
  // Left leg
  const leftUpperLeg = new THREE.Mesh(upperLegGeometry, legMaterial);
  leftUpperLeg.position.set(-0.08, 0.6, 0);
  scene.add(leftUpperLeg);
  
  const leftLowerLeg = new THREE.Mesh(lowerLegGeometry, legMaterial);
  leftLowerLeg.position.set(-0.08, 0.2, 0);
  scene.add(leftLowerLeg);
  
  // Right leg
  const rightUpperLeg = new THREE.Mesh(upperLegGeometry, legMaterial);
  rightUpperLeg.position.set(0.08, 0.6, 0);
  scene.add(rightUpperLeg);
  
  const rightLowerLeg = new THREE.Mesh(lowerLegGeometry, legMaterial);
  rightLowerLeg.position.set(0.08, 0.2, 0);
  scene.add(rightLowerLeg);
  
  // Feet
  const footGeometry = new THREE.BoxGeometry(0.08, 0.04, 0.15);
  const footMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  
  const leftFoot = new THREE.Mesh(footGeometry, footMaterial);
  leftFoot.position.set(-0.08, 0.02, 0.05);
  scene.add(leftFoot);
  
  const rightFoot = new THREE.Mesh(footGeometry, footMaterial);
  rightFoot.position.set(0.08, 0.02, 0.05);
  scene.add(rightFoot);
  
  // Create animation mixer
  const mixer = new THREE.AnimationMixer(scene);
  
  // Store references for animation
  const avatarParts = {
    head,
    mouth,
    leftEye,
    rightEye,
    leftUpperArm,
    rightUpperArm,
    torso
  };
  
  // Create morph targets simulation with visual feedback
  const morphTargets: { [key: string]: number } = {
    'viseme_aa': 0,
    'viseme_E': 0,
    'viseme_I': 0,
    'viseme_O': 0,
    'viseme_U': 0,
    'viseme_PP': 0,
    'viseme_FF': 0,
    'viseme_DD': 0,
    'viseme_kk': 0,
    'viseme_nn': 0,
    'viseme_RR': 0,
    'viseme_sil': 1
  };
  
  // Store avatar parts for animation access
  (scene as any).avatarParts = avatarParts;
  
  resolve({
    scene,
    animations: [],
    mixer,
    morphTargets,
    head,
    skeleton: null
  });
} 