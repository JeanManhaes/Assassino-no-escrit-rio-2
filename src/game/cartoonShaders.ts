import * as THREE from 'three';

/**
 * Cartoon / Cel-Shading Materials and Visual Feedback
 * Generates stepped toon shading with custom ramp colors and crisp comic outlines.
 */

// Gradient map for Cel-Shading (3 steps: shadow, midtone, highlight)
export function createToonGradientTexture(): THREE.DataTexture {
  const format = THREE.RGBAFormat;
  const data = new Uint8Array([
    90, 95, 110, 255,   // Dark shadow step
    180, 185, 200, 255, // Midtone step
    255, 255, 255, 255  // Bright specular step
  ]);
  const texture = new THREE.DataTexture(data, 3, 1, format);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

const sharedGradientMap = createToonGradientTexture();

export function createCartoonMaterial(options: {
  color: number | string | THREE.Color;
  map?: THREE.Texture | null;
  roughness?: number;
  emissive?: number | string | THREE.Color;
  emissiveIntensity?: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
}): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color: options.color,
    gradientMap: sharedGradientMap,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1.0,
    side: options.side ?? THREE.FrontSide,
  });

  if (options.map) {
    mat.map = options.map;
  }

  if (options.emissive) {
    mat.emissive = new THREE.Color(options.emissive);
    mat.emissiveIntensity = options.emissiveIntensity ?? 0.2;
  }

  return mat;
}

// Inverted Hull Cartoon Outline Mesh generator
export function addCartoonOutline(mesh: THREE.Mesh, outlineThickness: number = 0.03, outlineColor: number = 0x111827): THREE.Mesh {
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: outlineColor,
    side: THREE.BackSide,
  });

  const outlineMesh = new THREE.Mesh(mesh.geometry, outlineMaterial);
  outlineMesh.scale.multiplyScalar(1 + outlineThickness);
  mesh.add(outlineMesh);
  return outlineMesh;
}

// Comic Hit Sparks and Squash-and-Stretch helper
export interface FloatingVFX {
  mesh: THREE.Object3D;
  life: number;
  maxLife: number;
  velocity: THREE.Vector3;
  update: (dt: number) => boolean; // returns false when dead
}

export function createComicHitBurst(
  pos: THREE.Vector3,
  scene: THREE.Scene,
  text: string = 'POW!'
): FloatingVFX {
  const group = new THREE.Group();
  group.position.copy(pos);
  group.position.y += 0.5;

  // Comic text sprite
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#facc15';
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 8;
  ctx.font = '900 52px "Impact", "Arial Black", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(text, 128, 64);
  ctx.fillText(text, 128, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(1.5, 0.75, 1);
  group.add(sprite);

  // Spark starburst
  const starGeo = new THREE.BufferGeometry();
  const starCount = 8;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const angle = (i / starCount) * Math.PI * 2;
    const r = (i % 2 === 0) ? 0.6 : 0.25;
    starPos[i * 3] = Math.cos(angle) * r;
    starPos[i * 3 + 1] = Math.sin(angle) * r;
    starPos[i * 3 + 2] = 0;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.LineBasicMaterial({ color: 0xfef08a, linewidth: 3 });
  const star = new THREE.LineLoop(starGeo, starMat);
  group.add(star);

  scene.add(group);

  const maxLife = 0.6;
  let life = maxLife;
  const velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.8,
    1.2 + Math.random() * 0.5,
    (Math.random() - 0.5) * 0.8
  );

  return {
    mesh: group,
    life,
    maxLife,
    velocity,
    update: (dt: number) => {
      life -= dt;
      if (life <= 0) {
        scene.remove(group);
        texture.dispose();
        spriteMaterial.dispose();
        starGeo.dispose();
        starMat.dispose();
        return false;
      }
      group.position.addScaledVector(velocity, dt);
      const progress = 1 - life / maxLife;
      const s = 1 + Math.sin(progress * Math.PI) * 0.5;
      group.scale.set(s, s, s);
      spriteMaterial.opacity = life / maxLife;
      return true;
    }
  };
}

// Cartoon Sweat Drop VFX (appears when nervous suspect or player approaches)
export function createSweatDrop(pos: THREE.Vector3, scene: THREE.Scene): FloatingVFX {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#38bdf8';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(32, 6);
  ctx.bezierCurveTo(46, 26, 52, 42, 52, 50);
  ctx.arc(32, 44, 20, 0, Math.PI);
  ctx.bezierCurveTo(12, 42, 18, 26, 32, 6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // White highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.beginPath();
  ctx.arc(26, 40, 5, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.4, 0.4, 1);
  sprite.position.copy(pos);
  scene.add(sprite);

  const maxLife = 0.9;
  let life = maxLife;
  const velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.3,
    0.4 + Math.random() * 0.3,
    (Math.random() - 0.5) * 0.3
  );

  return {
    mesh: sprite,
    life,
    maxLife,
    velocity,
    update: (dt: number) => {
      life -= dt;
      if (life <= 0) {
        scene.remove(sprite);
        texture.dispose();
        mat.dispose();
        return false;
      }
      sprite.position.addScaledVector(velocity, dt);
      mat.opacity = life / maxLife;
      return true;
    }
  };
}
