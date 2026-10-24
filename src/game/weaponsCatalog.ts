import * as THREE from 'three';
import { createCartoonMaterial } from './cartoonShaders';
import { WeaponPropType } from './physicsWorld';

/**
 * Shop & Weapon Arsenal Catalog
 * Stores weapon costs, lethality stats, firing mechanics and procedural 3D sculpted meshes.
 */

export interface ShopWeaponDef {
  id: string;
  name: string;
  type: WeaponPropType;
  cost: number;
  damage: number;
  lethality: string;
  description: string;
  icon: string;
  isRanged: boolean;
  ammoMax?: number;
  weightCategory: 'light' | 'medium' | 'heavy';
}

export const SHOP_WEAPONS: ShopWeaponDef[] = [
  {
    id: 'knife',
    name: 'Faca Tática Cerâmica',
    type: 'knife',
    cost: 10,
    damage: 85,
    lethality: 'Alta (Corpo a Corpo Rápido)',
    description: 'Lâmina afiada para neutralização rápida e silenciosa sem chamar atenção.',
    icon: '🔪',
    isRanged: false,
    weightCategory: 'light',
  },
  {
    id: 'stun_baton',
    name: 'Cassetete de Choque Tático',
    type: 'stun_baton',
    cost: 35,
    damage: 70,
    lethality: 'Média-Alta (Paralisação Elétrica)',
    description: 'Emite pulso elétrico atordoante que nocauteia alvos com arcos visíveis.',
    icon: '⚡',
    isRanged: false,
    weightCategory: 'light',
  },
  {
    id: 'slingshot',
    name: 'Estilingue de Precisão',
    type: 'slingshot',
    cost: 50,
    damage: 60,
    lethality: 'Média (Disparo Silencioso)',
    description: 'Dispara esferas de aço que atordoam e derrubam alvos à média distância.',
    icon: '🎯',
    isRanged: true,
    ammoMax: 20,
    weightCategory: 'light',
  },
  {
    id: 'whip',
    name: 'Chicote de Couro Trançado',
    type: 'whip',
    cost: 60,
    damage: 75,
    lethality: 'Média-Alta (Alcance Estendido)',
    description: 'Alcance amplo que desarma e derruba suspeitos com estalo sônico.',
    icon: '➰',
    isRanged: false,
    weightCategory: 'medium',
  },
  {
    id: 'pistol',
    name: 'Pistola Silenciada 9mm',
    type: 'pistol',
    cost: 80,
    damage: 100,
    lethality: 'Letal (1 Tiro Neutraliza)',
    description: 'Arma de fogo com silenciador tático. Neutralização precisa à distância.',
    icon: '🔫',
    isRanged: true,
    ammoMax: 12,
    weightCategory: 'medium',
  },
  {
    id: 'revolver',
    name: 'Revólver .38 Magnum',
    type: 'revolver',
    cost: 100,
    damage: 110,
    lethality: 'Extrema (Impacto Devastador)',
    description: 'Tiro potente com tambor de 6 tiros e coice pesado que dispara qualquer suspeito.',
    icon: '💥',
    isRanged: true,
    ammoMax: 6,
    weightCategory: 'medium',
  },
  {
    id: 'crossbow',
    name: 'Besta Tática de Precisão',
    type: 'crossbow',
    cost: 125,
    damage: 115,
    lethality: 'Alta (Disparo Silencioso Fatal)',
    description: 'Dispara virotes com ponta de carbono em alta velocidade sem emitir som.',
    icon: '🏹',
    isRanged: true,
    ammoMax: 16,
    weightCategory: 'medium',
  },
  {
    id: 'extinguisher',
    name: 'Extintor de Incêndio Industrial',
    type: 'extinguisher',
    cost: 150,
    damage: 100,
    lethality: 'Pesada (Arremesso Nocauteador)',
    description: 'Tanque pesado de CO2. Pode ser golpeado ou arremessado causando ragdoll instantâneo.',
    icon: '🧯',
    isRanged: false,
    weightCategory: 'heavy',
  },
  {
    id: 'sledgehammer',
    name: 'Marreta de Demolição Pesada',
    type: 'sledgehammer',
    cost: 180,
    damage: 130,
    lethality: 'Massiva (Nocaute Sísmico Devastador)',
    description: 'Cabeça maciça de aço temperado. Qualquer golpe arremessa o alvo em ragdoll imediato.',
    icon: '🔨',
    isRanged: false,
    weightCategory: 'heavy',
  },
  {
    id: 'katana',
    name: 'Katana Cerimonial do Presidente',
    type: 'katana',
    cost: 220,
    damage: 140,
    lethality: 'Crítica (Corte Cirúrgico de Precisão)',
    description: 'Aço dobrado e polido do acervo executivo. Alcance afiado e golpes fulminantes.',
    icon: '⚔️',
    isRanged: false,
    weightCategory: 'medium',
  },
  {
    id: 'laser_gun',
    name: 'Arma de Laser Quântico',
    type: 'laser_gun',
    cost: 300,
    damage: 150,
    lethality: 'Instantânea (Tecnologia Experimental)',
    description: 'Projeta feixe de plasma concentrado com precisão cirúrgica.',
    icon: '⚡',
    isRanged: true,
    ammoMax: 30,
    weightCategory: 'light',
  },
  {
    id: 'plasma_rifle',
    name: 'Rifle de Plasma Subatômico',
    type: 'plasma_rifle',
    cost: 450,
    damage: 190,
    lethality: 'Suprema (Desintegração Instantânea)',
    description: 'Armamento de ponta da divisão de protótipos secretos com projéteis hiper-carregados.',
    icon: '🔮',
    isRanged: true,
    ammoMax: 45,
    weightCategory: 'heavy',
  },
];

/**
 * Builds high-fidelity procedural 3D sculpted meshes for purchased weapons
 */
export function buildWeaponMesh(type: WeaponPropType): THREE.Group {
  const group = new THREE.Group();

  if (type === 'knife') {
    // Sculpted Tactical Knife
    const bladeGeo = new THREE.BoxGeometry(0.04, 0.22, 0.008);
    const bladeMat = createCartoonMaterial({ color: 0xe2e8f0, emissive: 0x94a3b8, emissiveIntensity: 0.2 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.y = 0.11;

    const guardGeo = new THREE.BoxGeometry(0.08, 0.015, 0.02);
    const guardMat = createCartoonMaterial({ color: 0x1e293b });
    const guard = new THREE.Mesh(guardGeo, guardMat);

    const gripGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.14, 8);
    const gripMat = createCartoonMaterial({ color: 0x0f172a });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = -0.07;

    group.add(blade);
    group.add(guard);
    group.add(grip);
  } else if (type === 'pistol') {
    // Sculpted 9mm Pistol with Silencer
    const frameGeo = new THREE.BoxGeometry(0.05, 0.12, 0.18);
    const frameMat = createCartoonMaterial({ color: 0x18181b });
    const frame = new THREE.Mesh(frameGeo, frameMat);

    const slideGeo = new THREE.BoxGeometry(0.052, 0.05, 0.22);
    const slideMat = createCartoonMaterial({ color: 0x334155 });
    const slide = new THREE.Mesh(slideGeo, slideMat);
    slide.position.set(0, 0.06, 0.02);

    const silencerGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.18, 12);
    const silencerMat = createCartoonMaterial({ color: 0x09090b });
    const silencer = new THREE.Mesh(silencerGeo, silencerMat);
    silencer.rotation.x = Math.PI / 2;
    silencer.position.set(0, 0.06, -0.18);

    group.add(frame);
    group.add(slide);
    group.add(silencer);
  } else if (type === 'revolver') {
    // Sculpted .38 Magnum Revolver
    const gripGeo = new THREE.BoxGeometry(0.045, 0.13, 0.08);
    const gripMat = createCartoonMaterial({ color: 0x78350f }); // wooden handle
    const grip = new THREE.Mesh(gripGeo, gripMat);

    const cylinderGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.07, 12);
    const cylinderMat = createCartoonMaterial({ color: 0x475569 });
    const cylinder = new THREE.Mesh(cylinderGeo, cylinderMat);
    cylinder.rotation.x = Math.PI / 2;
    cylinder.position.set(0, 0.06, 0.02);

    const barrelGeo = new THREE.BoxGeometry(0.035, 0.045, 0.22);
    const barrelMat = createCartoonMaterial({ color: 0x94a3b8 });
    const barrel = new THREE.Mesh(barrelGeo, barrelMat);
    barrel.position.set(0, 0.06, -0.14);

    group.add(grip);
    group.add(cylinder);
    group.add(barrel);
  } else if (type === 'slingshot') {
    // Sculpted Slingshot Y-fork
    const forkGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.16, 8);
    const forkMat = createCartoonMaterial({ color: 0xb45309 });
    const handle = new THREE.Mesh(forkGeo, forkMat);

    const leftArmGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8);
    const lArm = new THREE.Mesh(leftArmGeo, forkMat);
    lArm.position.set(-0.04, 0.11, 0);
    lArm.rotation.z = 0.4;

    const rightArmGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8);
    const rArm = new THREE.Mesh(rightArmGeo, forkMat);
    rArm.position.set(0.04, 0.11, 0);
    rArm.rotation.z = -0.4;

    const bandGeo = new THREE.BoxGeometry(0.12, 0.008, 0.02);
    const bandMat = createCartoonMaterial({ color: 0xef4444 });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.set(0, 0.15, 0);

    group.add(handle);
    group.add(lArm);
    group.add(rArm);
    group.add(band);
  } else if (type === 'whip') {
    // Sculpted Leather Whip
    const handleGeo = new THREE.CylinderGeometry(0.018, 0.02, 0.22, 8);
    const handleMat = createCartoonMaterial({ color: 0x3f1e07 });
    const handle = new THREE.Mesh(handleGeo, handleMat);

    // Coiled whip lash
    const lashGeo = new THREE.TorusGeometry(0.08, 0.012, 8, 24, Math.PI * 1.8);
    const lashMat = createCartoonMaterial({ color: 0x1c1917 });
    const lash = new THREE.Mesh(lashGeo, lashMat);
    lash.position.set(0, 0.14, 0);
    lash.rotation.x = Math.PI / 2;

    group.add(handle);
    group.add(lash);
  } else if (type === 'laser_gun') {
    // Sculpted Sci-Fi Laser Blaster
    const bodyGeo = new THREE.BoxGeometry(0.06, 0.1, 0.28);
    const bodyMat = createCartoonMaterial({ color: 0x0284c7 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);

    const coreGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.16, 12);
    const coreMat = createCartoonMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.9 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.04, 0);

    const muzzleGeo = new THREE.CylinderGeometry(0.032, 0.025, 0.06, 12);
    const muzzleMat = createCartoonMaterial({ color: 0x0ea5e9 });
    const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0.04, -0.16);

    group.add(body);
    group.add(core);
    group.add(muzzle);
  } else if (type === 'extinguisher') {
    const tankGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.55, 12);
    const tankMat = createCartoonMaterial({ color: 0xef4444 });
    const tank = new THREE.Mesh(tankGeo, tankMat);

    const valveGeo = new THREE.BoxGeometry(0.08, 0.1, 0.16);
    const valveMat = createCartoonMaterial({ color: 0x334155 });
    const valve = new THREE.Mesh(valveGeo, valveMat);
    valve.position.y = 0.32;

    group.add(tank);
    group.add(valve);
  } else if (type === 'stun_baton') {
    // Tactical Shock Baton with high-voltage pulsing rings
    const gripGeo = new THREE.CylinderGeometry(0.022, 0.024, 0.18, 8);
    const gripMat = createCartoonMaterial({ color: 0x18181b });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.y = -0.09;

    const guardGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.02, 8);
    const guardMat = createCartoonMaterial({ color: 0x334155 });
    const guard = new THREE.Mesh(guardGeo, guardMat);

    const rodGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.38, 8);
    const rodMat = createCartoonMaterial({ color: 0x64748b });
    const rod = new THREE.Mesh(rodGeo, rodMat);
    rod.position.y = 0.19;

    // Electric conductive nodes with emissive cyan glow
    const sparkMat = createCartoonMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.9 });
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.TorusGeometry(0.024, 0.006, 6, 12);
      const ring = new THREE.Mesh(ringGeo, sparkMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.12 + i * 0.1;
      group.add(ring);
    }

    group.add(grip);
    group.add(guard);
    group.add(rod);
  } else if (type === 'crossbow') {
    // Compact Tactical Crossbow
    const stockGeo = new THREE.BoxGeometry(0.05, 0.08, 0.42);
    const stockMat = createCartoonMaterial({ color: 0x27272a });
    const stock = new THREE.Mesh(stockGeo, stockMat);

    const limbGeo = new THREE.BoxGeometry(0.42, 0.02, 0.04);
    const limbMat = createCartoonMaterial({ color: 0x0f172a });
    const limb = new THREE.Mesh(limbGeo, limbMat);
    limb.position.set(0, 0.03, -0.16);

    const stringGeo = new THREE.BoxGeometry(0.4, 0.005, 0.005);
    const stringMat = createCartoonMaterial({ color: 0xef4444 });
    const bowString = new THREE.Mesh(stringGeo, stringMat);
    bowString.position.set(0, 0.035, -0.04);

    const scopeGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8);
    const scopeMat = createCartoonMaterial({ color: 0x0284c7 });
    const scope = new THREE.Mesh(scopeGeo, scopeMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.065, 0);

    group.add(stock);
    group.add(limb);
    group.add(bowString);
    group.add(scope);
  } else if (type === 'sledgehammer') {
    // Heavy Industrial Demolition Sledgehammer
    const handleGeo = new THREE.CylinderGeometry(0.02, 0.024, 0.75, 8);
    const handleMat = createCartoonMaterial({ color: 0xb45309 });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.position.y = -0.1;

    const headGeo = new THREE.BoxGeometry(0.16, 0.15, 0.28);
    const headMat = createCartoonMaterial({ color: 0x334155 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.3, 0);

    const bandGeo = new THREE.BoxGeometry(0.165, 0.04, 0.08);
    const bandMat = createCartoonMaterial({ color: 0xf59e0b });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.position.set(0, 0.3, 0);

    group.add(handle);
    group.add(head);
    group.add(band);
  } else if (type === 'katana') {
    // Ceremonial Executive Katana
    const bladeGeo = new THREE.BoxGeometry(0.02, 0.68, 0.04);
    const bladeMat = createCartoonMaterial({ color: 0xf1f5f9, emissive: 0x94a3b8, emissiveIntensity: 0.3 });
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.position.set(0, 0.36, -0.01);

    const guardGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12);
    const guardMat = createCartoonMaterial({ color: 0xd97706 });
    const guard = new THREE.Mesh(guardGeo, guardMat);
    guard.position.y = 0.02;

    const tsukaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8);
    const tsukaMat = createCartoonMaterial({ color: 0x09090b });
    const tsuka = new THREE.Mesh(tsukaGeo, tsukaMat);
    tsuka.position.y = -0.09;

    group.add(blade);
    group.add(guard);
    group.add(tsuka);
  } else if (type === 'plasma_rifle') {
    // Experimental Subatomic Plasma Rifle
    const chassisGeo = new THREE.BoxGeometry(0.08, 0.14, 0.44);
    const chassisMat = createCartoonMaterial({ color: 0x0f172a });
    const chassis = new THREE.Mesh(chassisGeo, chassisMat);

    const plasmaCoreGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 12);
    const plasmaCoreMat = createCartoonMaterial({ color: 0xa855f7, emissive: 0xa855f7, emissiveIntensity: 1.2 });
    const core = new THREE.Mesh(plasmaCoreGeo, plasmaCoreMat);
    core.rotation.x = Math.PI / 2;
    core.position.set(0, 0.03, 0.02);

    const coilGeo = new THREE.TorusGeometry(0.045, 0.008, 6, 16);
    const coilMat = createCartoonMaterial({ color: 0x7c3aed, emissive: 0x9333ea, emissiveIntensity: 0.8 });
    for (let c = -1; c <= 1; c++) {
      const coil = new THREE.Mesh(coilGeo, coilMat);
      coil.rotation.y = Math.PI / 2;
      coil.position.set(0, 0.03, c * 0.08);
      group.add(coil);
    }

    const emitterGeo = new THREE.CylinderGeometry(0.04, 0.03, 0.08, 12);
    const emitterMat = createCartoonMaterial({ color: 0x1e1b4b });
    const emitter = new THREE.Mesh(emitterGeo, emitterMat);
    emitter.rotation.x = Math.PI / 2;
    emitter.position.set(0, 0.03, -0.24);

    group.add(chassis);
    group.add(core);
    group.add(emitter);
  }

  return group;
}
