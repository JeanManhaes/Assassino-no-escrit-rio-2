import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PhysicsWorld, InteractiveProp } from './physicsWorld';
import { generateProceduralOffice, GeneratedOffice } from './proceduralOffice';
import { CharacterNPC } from './characterRagdoll';
import { generateMatchData, MatchDossier, EmployeeProfile } from './npcData';
import { soundEngine } from './audioEngine';
import { createComicHitBurst, createSweatDrop, FloatingVFX } from './cartoonShaders';
import { navSystem } from './pathfinding';
import { TrajectoryPredictor } from './trajectoryVfx';

import { buildWeaponMesh, ShopWeaponDef } from './weaponsCatalog';

export type GamePhase = 'TITLE' | 'PLAYING' | 'VICTORY' | 'GAME_OVER';

export interface GameEventCallbacks {
  onPhaseChange: (phase: GamePhase) => void;
  onTimeUpdate: (secondsLeft: number) => void;
  onHoverProp: (propName: string | null) => void;
  onHoverEmployee: (employee: EmployeeProfile | null) => void;
  onHeldPropChange: (prop: InteractiveProp | null) => void;
  onRoomChange: (roomName: string) => void;
  onChargeUpdate: (chargeLevel: number) => void;
  onKillerEliminated?: (status: { remaining: number; total: number; killerName: string; killerRole: string }) => void;
  onBlackoutChange?: (isBlackout: boolean) => void;
  onGameOver: (result: {
    won: boolean;
    reason: string;
    victim?: EmployeeProfile;
    murderer?: EmployeeProfile;
    secretWeapon?: string;
    motive?: string;
    phase: number;
    coinsEarned?: number;
    totalKillers?: number;
  }) => void;
}

export class OfficeGame {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock: THREE.Clock;
  private physicsWorld: PhysicsWorld;
  private officeData!: GeneratedOffice;
  private matchDossier!: MatchDossier;
  private npcs: CharacterNPC[] = [];
  private vfxList: FloatingVFX[] = [];
  private callbacks: GameEventCallbacks;
  private trajectoryPredictor!: TrajectoryPredictor;

  // Game Loop & State
  public phase: GamePhase = 'TITLE';
  public phaseNumber: number = 1;
  public currentPhaseDuration: number = 120;
  public timeLeft: number = 120;
  public remainingKillers: Set<string> = new Set();
  public equippedShopWeaponId: string | null = null;
  private isPointerLocked: boolean = false;
  private animationFrameId: number = 0;
  private currentRoomName: string = 'Gabinete do CEO';

  // Blackout & Flashlight Mechanics
  public isBlackoutActive: boolean = false;
  public hasBlackoutOccurredThisPhase: boolean = false;
  private flashlight!: THREE.SpotLight;
  private flashlightTarget!: THREE.Object3D;
  private isHoveringGenerator: boolean = false;

  // First-Person Player State
  private playerPos: THREE.Vector3 = new THREE.Vector3(-17, 1.7, -13.5);
  private playerVelocity: THREE.Vector3 = new THREE.Vector3();
  private pitch: number = -0.12;
  private yaw: number = 2.8;
  private targetPitch: number = -0.12;
  private targetYaw: number = 2.8;
  private ignoreMouseFrames: number = 0;
  private keysHeld: Record<string, boolean> = {};
  private touchMoveVector: THREE.Vector3 = new THREE.Vector3();

  // Held Item & Weapon View Model
  public heldProp: InteractiveProp | null = null;
  private heldPivot: THREE.Group;
  private swingTimer: number = 0;
  private isSwinging: boolean = false;
  private hoveredProp: InteractiveProp | null = null;
  private hoveredNPC: CharacterNPC | null = null;

  // Throw Charging Mechanic
  private isChargingThrow: boolean = false;
  private throwChargeLevel: number = 0;
  private lastChargeTickTime: number = 0;

  // Suspense & AI Timers
  private lastTickSecond: number = 120;
  private lastHeartbeatTime: number = 0;
  private sweatSpawnTimer: number = 0;
  private killerDecisionTimer: number = 4.0;
  private npcRoutineTimer: number = 6.0;
  private gameElapsedTime: number = 0;
  private scheduledBlackoutTime: number = 42;
  private stealthKillsCount: number = 0;
  private stealthAssassinationTimer: number = 24.0;

  constructor(container: HTMLElement, callbacks: GameEventCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.clock = new THREE.Clock();

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);
    this.scene.fog = new THREE.FogExp2(0x0f172a, 0.022);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    this.camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 80);
    this.camera.position.copy(this.playerPos);

    this.heldPivot = new THREE.Group();
    this.heldPivot.position.set(0.35, -0.3, -0.55);
    this.camera.add(this.heldPivot);

    // Tactical Flashlight for Blackout emergencies
    this.flashlightTarget = new THREE.Object3D();
    this.flashlightTarget.position.set(0, 0, -8);
    this.camera.add(this.flashlightTarget);

    this.flashlight = new THREE.SpotLight(0xffffff, 0, 28, Math.PI / 4.2, 0.45, 1.1);
    this.flashlight.position.set(0, -0.1, 0.1);
    this.flashlight.target = this.flashlightTarget;
    this.camera.add(this.flashlight);

    this.scene.add(this.camera);

    this.physicsWorld = new PhysicsWorld();
    this.trajectoryPredictor = new TrajectoryPredictor(this.scene);

    // Initial procedural generation
    this.matchDossier = generateMatchData(1);
    this.officeData = generateProceduralOffice(this.scene, this.physicsWorld, this.matchDossier.themeStyle);
    this.spawnCharacters();

    this.setupInputs();
    this.startLoop();
  }

  private setupInputs() {
    const canvas = this.renderer.domElement;

    canvas.addEventListener('click', () => {
      if (this.phase === 'PLAYING' && !this.isPointerLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = (document.pointerLockElement === canvas);
      if (this.isPointerLocked) {
        this.ignoreMouseFrames = 2;
        this.targetYaw = this.yaw;
        this.targetPitch = this.pitch;
      }
    });

    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isPointerLocked || this.phase !== 'PLAYING') return;
      if (this.ignoreMouseFrames > 0) {
        this.ignoreMouseFrames--;
        return;
      }
      // Clamping delta prevents sudden pointer-lock teleports / snaps
      const dx = Math.max(-75, Math.min(75, e.movementX));
      const dy = Math.max(-75, Math.min(75, e.movementY));
      const sensitivity = 0.0022;
      this.targetYaw -= dx * sensitivity;
      this.targetPitch -= dy * sensitivity;
      this.targetPitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.targetPitch));
    });

    // Mousedown: LMB = Strike, RMB = Start Charging Throw
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
      if (this.phase !== 'PLAYING' || !this.isPointerLocked) return;

      if (e.button === 0) {
        this.performMeleeAttack();
      } else if (e.button === 2) {
        e.preventDefault();
        if (this.heldProp) {
          this.isChargingThrow = true;
          this.throwChargeLevel = 0;
        }
      }
    });

    // Mouseup: RMB release = Launch Charged Throw!
    window.addEventListener('mouseup', (e: MouseEvent) => {
      if (e.button === 2 && this.isChargingThrow) {
        this.releaseChargedThrow();
      }
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      this.keysHeld[e.code] = true;
      if (e.code === 'KeyE' && this.phase === 'PLAYING') {
        this.handleInteractKey();
      }
    });

    window.addEventListener('keyup', (e: KeyboardEvent) => {
      this.keysHeld[e.code] = false;
    });

    window.addEventListener('resize', this.onResize);
  }

  private onResize = () => {
    if (!this.container) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public startNewGame(phase: number = 1, weaponToEquip?: ShopWeaponDef) {
    soundEngine.stopAmbientMusic();

    this.phaseNumber = Math.max(1, Math.min(15, phase));
    // Escalating time duration up to 15 phases (Phase 1 = 120s, +60s each phase up to 960s)
    this.currentPhaseDuration = Math.min(960, 60 + this.phaseNumber * 60);
    this.timeLeft = this.currentPhaseDuration;
    this.lastTickSecond = this.currentPhaseDuration;
    this.gameElapsedTime = 0;
    this.isBlackoutActive = false;
    this.hasBlackoutOccurredThisPhase = false;
    // Blackout triggers randomly anytime after 30 seconds of play!
    this.scheduledBlackoutTime = 30 + Math.random() * 35;
    this.stealthKillsCount = 0;
    this.stealthAssassinationTimer = 22 + Math.random() * 15;

    if (this.flashlight) this.flashlight.intensity = 0;
    this.callbacks.onBlackoutChange?.(false);
    this.phase = 'PLAYING';
    this.isChargingThrow = false;
    this.throwChargeLevel = 0;
    this.trajectoryPredictor.hide();
    this.callbacks.onPhaseChange('PLAYING');
    this.callbacks.onTimeUpdate(this.currentPhaseDuration);
    this.callbacks.onChargeUpdate(0);

    if (this.heldProp) {
      this.dropHeldProp(false);
    }

    // Complete cleanup of all previous NPCs, ragdoll limbs, and meshes
    for (const npc of this.npcs) {
      npc.dispose();
    }
    this.npcs = [];

    if (this.officeData) {
      this.scene.remove(this.officeData.officeGroup);
    }
    this.physicsWorld.clear();

    // Generate fresh match dossier and procedural office with escalating killers
    this.matchDossier = generateMatchData(this.phaseNumber);
    this.remainingKillers = new Set(this.matchDossier.murdererIds);
    this.officeData = generateProceduralOffice(this.scene, this.physicsWorld, this.matchDossier.themeStyle);

    // Place Player facing executive desk
    this.playerPos.set(-17, 1.7, -13.5);
    this.yaw = 2.8;
    this.targetYaw = 2.8;
    this.pitch = -0.12; // tilted toward executive desk and doorway
    this.targetPitch = -0.12;
    this.playerVelocity.set(0, 0, 0);

    this.spawnCharacters();

    if (weaponToEquip) {
      this.equipShopWeapon(weaponToEquip);
    }

    // Start Procedural Ambient Suspense Music
    soundEngine.startAmbientMusic();

    this.renderer.domElement.requestPointerLock();
  }

  public equipShopWeapon(weaponDef: ShopWeaponDef) {
    if (this.heldProp) {
      this.dropHeldProp(false);
    }
    const mesh = buildWeaponMesh(weaponDef.type);
    const mass = weaponDef.weightCategory === 'light' ? 0.6 : (weaponDef.weightCategory === 'medium' ? 1.5 : 4.0);
    const body = new CANNON.Body({
      mass,
      shape: new CANNON.Box(new CANNON.Vec3(0.08, 0.16, 0.08)),
      position: new CANNON.Vec3(this.playerPos.x, this.playerPos.y, this.playerPos.z)
    });
    const prop: InteractiveProp = {
      id: `shop-${weaponDef.id}-${Date.now()}`,
      name: weaponDef.name,
      type: weaponDef.type,
      mesh,
      body,
      isHeld: true,
      damage: weaponDef.damage,
      weightCategory: weaponDef.weightCategory
    };
    this.physicsWorld.registerProp(prop);
    this.heldProp = prop;
    this.equippedShopWeaponId = weaponDef.id;
    this.heldPivot.clear();
    this.heldPivot.add(prop.mesh);
    prop.mesh.position.set(0, 0, 0);
    prop.mesh.rotation.set(0, 0, 0);
    this.callbacks.onHeldPropChange(prop);
  }

  public getMatchDossier(): MatchDossier {
    return this.matchDossier;
  }

  public setTouchMove(x: number, z: number) {
    this.touchMoveVector.set(x, 0, z);
  }

  public addTouchLook(dx: number, dy: number) {
    const sensitivity = 0.003;
    this.yaw -= dx * sensitivity;
    this.pitch -= dy * sensitivity;
    this.pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, this.pitch));
  }

  public triggerMeleeAction() {
    if (this.phase === 'PLAYING') this.performMeleeAttack();
  }

  public triggerThrowAction() {
    if (this.phase === 'PLAYING') {
      if (this.heldProp) {
        this.throwChargeLevel = 0.85; // Mobile tap uses 85% full throw power
        this.releaseChargedThrow();
      }
    }
  }

  public triggerInteractAction() {
    if (this.phase === 'PLAYING') this.handleInteractKey();
  }

  private spawnCharacters() {
    const points = [...this.officeData.spawnPoints].sort(() => Math.random() - 0.5);

    this.matchDossier.employees.forEach((emp, idx) => {
      const pt = points[idx % points.length];
      const spawnY = pt.pos.y || 0;
      const spawnPos = new THREE.Vector3(pt.pos.x, spawnY, pt.pos.z);
      emp.spawnPosition = [spawnPos.x, spawnPos.y, spawnPos.z];
      emp.homeNodeId = pt.nodeId;

      const npc = new CharacterNPC(emp, spawnPos, this.scene, this.physicsWorld.world);
      this.npcs.push(npc);
    });
  }

  private handleInteractKey() {
    if (this.isHoveringGenerator) {
      this.restorePower();
    } else if (this.hoveredProp) {
      this.pickupProp(this.hoveredProp);
    } else if (this.heldProp) {
      this.dropHeldProp(true);
    }
  }

  private pickupProp(prop: InteractiveProp) {
    if (this.heldProp) {
      this.dropHeldProp(false);
    }

    this.heldProp = prop;
    prop.isHeld = true;

    prop.body.wakeUp();
    prop.body.velocity.set(0, 0, 0);
    prop.body.angularVelocity.set(0, 0, 0);

    this.heldPivot.add(prop.mesh);
    prop.mesh.position.set(0, 0, 0);
    prop.mesh.rotation.set(0, Math.PI / 4, 0);

    if (prop.type === 'chair') {
      prop.mesh.scale.set(0.45, 0.45, 0.45);
      prop.mesh.position.set(-0.1, -0.2, 0.2);
    } else if (prop.type === 'monitor') {
      prop.mesh.scale.set(0.65, 0.65, 0.65);
      prop.mesh.position.set(0, -0.15, 0.1);
    } else {
      prop.mesh.scale.set(1, 1, 1);
    }

    soundEngine.playPickup();
    this.callbacks.onHeldPropChange(prop);
  }

  private dropHeldProp(withGentleToss: boolean = false) {
    if (!this.heldProp) return;
    const prop = this.heldProp;
    this.heldProp = null;
    prop.isHeld = false;

    this.isChargingThrow = false;
    this.throwChargeLevel = 0;
    this.trajectoryPredictor.hide();
    this.callbacks.onChargeUpdate(0);

    prop.mesh.scale.set(1, 1, 1);
    this.officeData.officeGroup.attach(prop.mesh);

    const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
    const dropPos = this.playerPos.clone().addScaledVector(forward, 0.9);
    dropPos.y = Math.max(0.4, this.playerPos.y - 0.4);

    prop.body.position.set(dropPos.x, dropPos.y, dropPos.z);
    prop.body.wakeUp();

    if (withGentleToss) {
      prop.body.velocity.set(forward.x * 2.5, 1.8, forward.z * 2.5);
    } else {
      prop.body.velocity.set(0, 0, 0);
    }

    this.callbacks.onHeldPropChange(null);
  }

  private performMeleeAttack() {
    if (this.isSwinging) return;

    // If holding a ranged weapon, perform ballistic/energy shot instead of swing!
    if (this.heldProp && (
      this.heldProp.type === 'pistol' || 
      this.heldProp.type === 'revolver' || 
      this.heldProp.type === 'slingshot' || 
      this.heldProp.type === 'laser_gun' ||
      this.heldProp.type === 'crossbow' ||
      this.heldProp.type === 'plasma_rifle'
    )) {
      this.performRangedAttack();
      return;
    }

    this.isSwinging = true;
    this.swingTimer = 0.22;

    if (this.heldProp?.type === 'whip') {
      soundEngine.playWhipCrack();
    } else if (this.heldProp?.type === 'stun_baton') {
      soundEngine.playStunBaton();
    } else if (this.heldProp?.type === 'sledgehammer') {
      soundEngine.playHammerSmash();
    } else if (this.heldProp?.type === 'katana') {
      soundEngine.playKatanaSlash();
    } else {
      soundEngine.playSwing();
    }

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')).normalize();

    const attackOrigin = this.playerPos.clone();
    const hitReach = (this.heldProp?.type === 'whip') 
      ? 3.8 
      : (this.heldProp?.type === 'katana' ? 3.4 : ((this.heldProp?.type === 'chair' || this.heldProp?.type === 'sledgehammer' || this.heldProp?.type === 'umbrella') ? 2.8 : 2.2));

    let targetHit: CharacterNPC | null = null;
    let minDist = hitReach;

    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      const charCenter = npc.group.position.clone();
      charCenter.y += 1.0;
      const toChar = charCenter.sub(attackOrigin);
      const dist = toChar.length();

      if (dist < minDist) {
        const dot = toChar.normalize().dot(forward);
        if (dot > 0.65) {
          minDist = dist;
          targetHit = npc;
        }
      }
    }

    if (targetHit) {
      const hitVfxText = this.heldProp?.type === 'chair' 
        ? 'SMASH!' 
        : (this.heldProp?.type === 'sledgehammer' 
          ? 'CRUSH!' 
          : (this.heldProp?.type === 'katana' 
            ? 'SLICE!' 
            : (this.heldProp?.type === 'stun_baton' 
              ? 'ZAAAP!' 
              : (this.heldProp?.type === 'knife' ? 'SLASH!' : (this.heldProp?.type === 'whip' ? 'CRACK!' : (this.heldProp?.type === 'stapler' ? 'KLAK!' : 'WHAM!'))))));
      
      this.vfxList.push(createComicHitBurst(targetHit.group.position.clone(), this.scene, hitVfxText));
      
      // Sledgehammer delivers massive knockback
      const ragdollImpulse = this.heldProp?.type === 'sledgehammer' ? forward.clone().multiplyScalar(2.2) : forward;
      targetHit.triggerRagdoll(ragdollImpulse);

      if (targetHit.profile.isMurderer) {
        this.spawnDroppedWeaponFromKiller(targetHit.group.position.clone());
      }

      this.evaluateMurderOutcome(targetHit);
    }
  }

  /**
   * Ranged firearm/energy shot with visual tracer and sound
   */
  private performRangedAttack() {
    if (this.isSwinging || !this.heldProp) return;
    this.isSwinging = true;
    this.swingTimer = 0.24;

    const prop = this.heldProp;
    if (prop.type === 'pistol') {
      soundEngine.playPistolShot();
    } else if (prop.type === 'revolver') {
      soundEngine.playRevolverBlast();
    } else if (prop.type === 'slingshot') {
      soundEngine.playSlingshotSnap();
    } else if (prop.type === 'laser_gun') {
      soundEngine.playLaserBeam();
    } else if (prop.type === 'crossbow') {
      soundEngine.playCrossbowShot();
    } else if (prop.type === 'plasma_rifle') {
      soundEngine.playPlasmaRifle();
    }

    // Heavy recoil kick on weapon view model
    this.heldPivot.position.z += 0.14;
    this.heldPivot.rotation.x += 0.4;

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')).normalize();

    // Visual Tracer Beam
    const startPoint = this.playerPos.clone().addScaledVector(forward, 0.4);
    const endPoint = startPoint.clone().addScaledVector(forward, 32);
    const beamColor = prop.type === 'plasma_rifle' 
      ? 0xa855f7 
      : (prop.type === 'laser_gun' 
        ? 0x38bdf8 
        : (prop.type === 'crossbow' 
          ? 0x10b981 
          : (prop.type === 'revolver' ? 0xf59e0b : 0xe2e8f0)));

    const laserMat = new THREE.LineBasicMaterial({
      color: beamColor,
      linewidth: (prop.type === 'plasma_rifle') ? 4 : 2,
    });
    const laserGeo = new THREE.BufferGeometry().setFromPoints([startPoint, endPoint]);
    const laserLine = new THREE.Line(laserGeo, laserMat);
    this.scene.add(laserLine);
    setTimeout(() => {
      this.scene.remove(laserLine);
      laserGeo.dispose();
      laserMat.dispose();
    }, 90);

    // Raycast hit check on NPCs
    const raycaster = new THREE.Raycaster(this.playerPos.clone(), forward, 0.2, 32);
    let targetHit: CharacterNPC | null = null;
    let minDistance = 32;

    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      const intersects = raycaster.intersectObject(npc.group, true);
      if (intersects.length > 0 && intersects[0].distance < minDistance) {
        minDistance = intersects[0].distance;
        targetHit = npc;
      }
    }

    if (targetHit) {
      const vfxText = prop.type === 'plasma_rifle' 
        ? 'VAPORIZE!' 
        : (prop.type === 'laser_gun' 
          ? 'ZAP!' 
          : (prop.type === 'crossbow' 
            ? 'THWIP!' 
            : (prop.type === 'revolver' ? 'BLAST!' : (prop.type === 'pistol' ? 'POW!' : 'SNICK!'))));
      
      this.vfxList.push(createComicHitBurst(targetHit.group.position.clone(), this.scene, vfxText));
      targetHit.triggerRagdoll(forward.clone());

      if (targetHit.profile.isMurderer) {
        this.spawnDroppedWeaponFromKiller(targetHit.group.position.clone());
      }

      this.evaluateMurderOutcome(targetHit);
    }
  }

  private spawnDroppedWeaponFromKiller(pos: THREE.Vector3) {
    const droppedMesh = buildWeaponMesh('knife');
    droppedMesh.position.copy(pos);
    droppedMesh.position.y += 0.8;
    this.officeData.officeGroup.add(droppedMesh);

    const body = new CANNON.Body({
      mass: 1.2,
      shape: new CANNON.Box(new CANNON.Vec3(0.08, 0.12, 0.08)),
      position: new CANNON.Vec3(pos.x, pos.y + 0.8, pos.z),
      velocity: new CANNON.Vec3((Math.random() - 0.5) * 2, 2.0, (Math.random() - 0.5) * 2)
    });

    const prop: InteractiveProp = {
      id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: 'Faca Tática do Infiltrado',
      type: 'knife',
      mesh: droppedMesh,
      body,
      isHeld: false,
      damage: 85,
      weightCategory: 'light'
    };

    this.physicsWorld.registerProp(prop);
  }

  /**
   * Release Charged Throw with High Distance Velocity & Trajectory Landing
   * FIX: Added velocity threshold and lifespan cutoff to prevent accidental game resets.
   */
  private releaseChargedThrow() {
    if (!this.heldProp) return;
    const prop = this.heldProp;
    const power = Math.max(0.3, this.throwChargeLevel);

    this.heldProp = null;
    prop.isHeld = false;
    this.isChargingThrow = false;
    this.throwChargeLevel = 0;
    this.trajectoryPredictor.hide();
    this.callbacks.onChargeUpdate(0);

    prop.mesh.scale.set(1, 1, 1);
    this.officeData.officeGroup.attach(prop.mesh);

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')).normalize();

    const spawnPos = this.playerPos.clone().addScaledVector(forward, 0.7);
    prop.body.position.set(spawnPos.x, spawnPos.y, spawnPos.z);
    prop.body.wakeUp();

    // High velocity projectile physics (Long Throw Distance!)
    const baseSpeed = prop.weightCategory === 'light' ? 36 : (prop.weightCategory === 'medium' ? 26 : 18);
    const speed = baseSpeed * (0.6 + power * 0.75);

    prop.body.velocity.set(
      forward.x * speed,
      forward.y * speed + 2.4 + power * 1.6,
      forward.z * speed
    );
    prop.body.angularVelocity.set(
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20,
      (Math.random() - 0.5) * 20
    );

    soundEngine.playThrow(power);
    this.callbacks.onHeldPropChange(null);

    const launchTime = performance.now();
    let collisionHandled = false;

    const onCollide = (e: { body: CANNON.Body }) => {
      if (collisionHandled) return;

      // PREVENT PREMATURE GAME RESET:
      // Only deliberate high-speed throws (> 4.8 m/s within 2.2 seconds) are lethal!
      const currentSpeed = prop.body.velocity.length();
      const elapsed = performance.now() - launchTime;
      if (currentSpeed < 4.8 || elapsed > 2200) {
        collisionHandled = true;
        prop.body.removeEventListener('collide', onCollide);
        return;
      }

      for (const npc of this.npcs) {
        if (!npc.isDead && (e.body === npc.kinematicBody)) {
          collisionHandled = true;
          prop.body.removeEventListener('collide', onCollide);
          this.vfxList.push(createComicHitBurst(npc.group.position.clone(), this.scene, 'KABOOM!'));
          npc.triggerRagdoll(forward.clone());

          // Recoil prop and make sure gravity pulls it down to the floor
          prop.body.wakeUp();
          prop.body.velocity.set(
            -forward.x * 2.8 + (Math.random() - 0.5) * 2,
            2.2,
            -forward.z * 2.8 + (Math.random() - 0.5) * 2
          );

          if (npc.profile.isMurderer) {
            this.spawnDroppedWeaponFromKiller(npc.group.position.clone());
          }

          this.evaluateMurderOutcome(npc);
          break;
        }
      }
    };

    prop.body.addEventListener('collide', onCollide);

    // Auto cleanup listener after 2.5 seconds so harmless stationary items never trigger game over
    setTimeout(() => {
      if (!collisionHandled) {
        collisionHandled = true;
        prop.body.removeEventListener('collide', onCollide);
      }
    }, 2500);
  }

  private evaluateMurderOutcome(victim: CharacterNPC) {
    const isGuilty = victim.profile.isMurderer;

    setTimeout(() => {
      if (isGuilty) {
        this.remainingKillers.delete(victim.profile.id);

        if (this.remainingKillers.size > 0) {
          // Multi-killer phase: Still more assassins left to eliminate!
          soundEngine.playEliminationStinger();
          this.vfxList.push(createComicHitBurst(victim.group.position.clone(), this.scene, 'INFILTRADO ELIMINADO!'));
          this.callbacks.onKillerEliminated?.({
            remaining: this.remainingKillers.size,
            total: this.matchDossier.murdererIds.length,
            killerName: victim.profile.name,
            killerRole: victim.profile.role
          });
        } else {
          // ALL killers in this phase eliminated! Victory!
          this.phase = 'VICTORY';
          soundEngine.playVictory();
          soundEngine.playCoinSound();

          // Coins: 100 max per phase, reduced by time spent
          const totalDuration = this.currentPhaseDuration;
          const timeRatio = Math.max(0.1, Math.min(1, this.timeLeft / totalDuration));
          const coinsEarned = Math.round(100 * timeRatio);

          this.callbacks.onPhaseChange('VICTORY');
          this.callbacks.onGameOver({
            won: true,
            reason: `Fase ${this.phaseNumber} Concluída! Você neutralizou todos os ${this.matchDossier.murdererIds.length} assassino(s) da organização infiltrada a tempo!`,
            victim: victim.profile,
            secretWeapon: this.matchDossier.secretWeapon,
            motive: this.matchDossier.motive,
            phase: this.phaseNumber,
            coinsEarned,
            totalKillers: this.matchDossier.murdererIds.length
          });
          document.exitPointerLock?.();
        }
      } else {
        this.phase = 'GAME_OVER';
        soundEngine.playDefeat();
        const realMurderer = this.matchDossier.employees.find(e => e.isMurderer);
        this.callbacks.onPhaseChange('GAME_OVER');
        this.callbacks.onGameOver({
          won: false,
          reason: `ERRO FATAL DE JULGAMENTO! Você atacou ${victim.profile.name} (${victim.profile.role}), um funcionário inocente da empresa! A polícia foi acionada e o sindicato de assassinos escapou.`,
          victim: victim.profile,
          murderer: realMurderer,
          secretWeapon: this.matchDossier.secretWeapon,
          motive: this.matchDossier.motive,
          phase: this.phaseNumber
        });
        document.exitPointerLock?.();
      }
    }, 700);
  }

  private startLoop() {
    const tick = () => {
      const dt = Math.min(this.clock.getDelta(), 0.05);

      if (this.phase === 'PLAYING') {
        this.updatePlayerMovement(dt);
        this.updateThrowCharging(dt);
        this.updateHeldWeaponAnimation(dt);
        this.updateTimer(dt);
        this.updateRaycasting();
        this.updateIntelligentAI(dt);
      } else if (this.phase === 'TITLE') {
        const t = this.clock.getElapsedTime() * 0.15;
        this.camera.position.set(Math.sin(t) * 14, 8, Math.cos(t) * 14);
        this.camera.lookAt(0, 1.5, 0);
      }

      this.physicsWorld.step(dt);
      this.vfxList = this.vfxList.filter(vfx => vfx.update(dt));

      if (this.officeData?.flickerLight) {
        const flicker = Math.sin(this.clock.getElapsedTime() * 18) > 0.7;
        this.officeData.flickerLight.intensity = flicker ? 0.3 : 1.3;
      }

      this.renderer.render(this.scene, this.camera);
      this.animationFrameId = requestAnimationFrame(tick);
    };

    this.animationFrameId = requestAnimationFrame(tick);
  }

  private updatePlayerMovement(dt: number) {
    // Fluid smooth rotation with exponential damping - eliminates any camera teleport or jitter
    this.yaw = THREE.MathUtils.damp(this.yaw, this.targetYaw, 35, dt);
    this.pitch = THREE.MathUtils.damp(this.pitch, this.targetPitch, 35, dt);

    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    let moveX = (this.keysHeld['KeyD'] ? 1 : 0) - (this.keysHeld['KeyA'] ? 1 : 0);
    let moveZ = (this.keysHeld['KeyS'] ? 1 : 0) - (this.keysHeld['KeyW'] ? 1 : 0);
    if (this.touchMoveVector.lengthSq() > 0.01) {
      moveX += this.touchMoveVector.x;
      moveZ += this.touchMoveVector.z;
    }
    const isMoving = (Math.abs(moveX) > 0.05 || Math.abs(moveZ) > 0.05);

    const speed = this.keysHeld['ShiftLeft'] ? 6.5 : 4.2;
    const moveDir = new THREE.Vector3(moveX, 0, moveZ);
    if (moveDir.lengthSq() > 1) moveDir.normalize();
    moveDir.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    if (isMoving) {
      this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, moveDir.x * speed, 12, dt);
      this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, moveDir.z * speed, 12, dt);

      if (Math.sin(this.clock.getElapsedTime() * (speed > 5 ? 14 : 9)) > 0.95) {
        soundEngine.playFootstep();
      }
    } else {
      this.playerVelocity.x = THREE.MathUtils.damp(this.playerVelocity.x, 0, 14, dt);
      this.playerVelocity.z = THREE.MathUtils.damp(this.playerVelocity.z, 0, 14, dt);
    }

    const nextX = this.playerPos.x + this.playerVelocity.x * dt;
    const nextZ = this.playerPos.z + this.playerVelocity.z * dt;

    this.playerPos.x = Math.max(-21.8, Math.min(21.8, nextX));
    this.playerPos.z = Math.max(-15.8, Math.min(15.8, nextZ));

    // SOLID ANTI-CLIPPING: Push player out of walls & furniture
    navSystem.resolveAllCollisions(this.playerPos, 0.45);

    // Multi-floor height calculation: Floor 1 (y=0), Stairs (y: 0 -> 4.0), Floor 2 (y=4.0)
    let groundBaseY = 0;
    if (this.playerPos.x >= 16.5 && this.playerPos.x <= 21.5 && this.playerPos.z >= 6.8 && this.playerPos.z <= 15.2) {
      // Ascending / Descending staircase
      const progress = (15.0 - this.playerPos.z) / 8.0;
      groundBaseY = Math.max(0, Math.min(4.0, progress * 4.0));
    } else if (this.playerPos.y >= 2.5 && this.playerPos.z <= 7.2 && this.playerPos.x >= -6.2 && this.playerPos.x <= 23.2) {
      // Walking on Floor 2 (Subestação e Sala dos Geradores)
      groundBaseY = 4.0;
    } else {
      groundBaseY = 0;
    }

    const bob = isMoving ? Math.sin(this.clock.getElapsedTime() * 11) * 0.04 : 0;
    this.playerPos.y = groundBaseY + 1.7 + bob;
    this.camera.position.copy(this.playerPos);

    for (const room of this.officeData.rooms) {
      if (
        this.playerPos.x >= room.min.x && this.playerPos.x <= room.max.x &&
        this.playerPos.z >= room.min.z && this.playerPos.z <= room.max.z &&
        this.playerPos.y >= room.min.y && this.playerPos.y <= room.max.y
      ) {
        if (room.name !== this.currentRoomName) {
          this.currentRoomName = room.name;
          this.callbacks.onRoomChange(room.name);
        }
        break;
      }
    }
  }

  private updateThrowCharging(dt: number) {
    if (!this.isChargingThrow || !this.heldProp) {
      this.trajectoryPredictor.hide();
      return;
    }

    this.throwChargeLevel = Math.min(1.0, this.throwChargeLevel + dt * 1.1);
    this.callbacks.onChargeUpdate(this.throwChargeLevel);

    const now = this.clock.getElapsedTime();
    if (now - this.lastChargeTickTime > 0.12) {
      this.lastChargeTickTime = now;
      soundEngine.playChargeTick(this.throwChargeLevel);
    }

    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')).normalize();
    const spawnPos = this.playerPos.clone().addScaledVector(forward, 0.6);

    this.trajectoryPredictor.updateTrajectory(
      spawnPos,
      forward,
      this.throwChargeLevel,
      this.heldProp.weightCategory
    );
  }

  private updateHeldWeaponAnimation(dt: number) {
    if (!this.heldProp) {
      this.heldPivot.position.set(0.35, -0.3, -0.55);
      return;
    }

    if (this.isSwinging) {
      this.swingTimer -= dt;
      const swingProgress = 1 - Math.max(0, this.swingTimer / 0.22);
      const angle = Math.sin(swingProgress * Math.PI) * 1.2;

      this.heldPivot.rotation.x = -angle * 0.8;
      this.heldPivot.rotation.z = angle * 0.5;
      this.heldPivot.position.z = -0.55 - Math.sin(swingProgress * Math.PI) * 0.3;

      if (this.swingTimer <= 0) {
        this.isSwinging = false;
        this.heldPivot.rotation.set(0, 0, 0);
      }
    } else if (this.isChargingThrow) {
      // Pull arm back in wind-up charge stance
      const pull = this.throwChargeLevel * 0.18;
      this.heldPivot.position.set(0.35 + pull * 0.3, -0.28 + pull * 0.2, -0.55 + pull);
      this.heldPivot.rotation.set(pull * 1.4, -pull * 0.8, pull * 0.6);
    } else {
      const t = this.clock.getElapsedTime();
      const swayX = Math.sin(t * 3) * 0.015;
      const swayY = Math.cos(t * 6) * 0.01;
      this.heldPivot.position.set(0.35 + swayX, -0.3 + swayY, -0.55);
      this.heldPivot.rotation.set(0, 0, 0);
    }
  }

  private updateTimer(dt: number) {
    this.gameElapsedTime += dt;
    this.timeLeft -= dt;
    const currentSec = Math.ceil(this.timeLeft);

    if (currentSec !== this.lastTickSecond) {
      this.lastTickSecond = currentSec;
      this.callbacks.onTimeUpdate(Math.max(0, currentSec));

      if (currentSec <= 60 && currentSec > 0) {
        soundEngine.playTick();
      }

      // BLACKOUT TRIGGER: Randomly triggered anytime after 30 seconds of play!
      if (this.gameElapsedTime >= this.scheduledBlackoutTime && !this.hasBlackoutOccurredThisPhase && !this.isBlackoutActive) {
        this.triggerBlackout();
      }
    }

    if (this.isBlackoutActive && this.officeData?.generatorLight) {
      const pulse = Math.sin(this.clock.getElapsedTime() * 7.5);
      this.officeData.generatorLight.intensity = pulse > 0 ? 2.6 : 0.4;
    }

    if (this.timeLeft <= 0) {
      this.timeLeft = 0;
      this.phase = 'GAME_OVER';
      soundEngine.playDefeat();
      const murderer = this.matchDossier.employees.find(e => e.isMurderer);
      this.callbacks.onPhaseChange('GAME_OVER');
      this.callbacks.onGameOver({
        won: false,
        reason: `TEMPO ESGOTADO! O tempo da Fase ${this.phaseNumber} (${this.currentPhaseDuration / 60} minutos) acabou. As luzes piscaram e o assassino te atacou pelas sombras!`,
        murderer,
        secretWeapon: this.matchDossier.secretWeapon,
        motive: this.matchDossier.motive,
        phase: this.phaseNumber
      });
      document.exitPointerLock?.();
    }
  }

  public triggerBlackout() {
    if (this.isBlackoutActive) return;
    this.isBlackoutActive = true;
    this.hasBlackoutOccurredThisPhase = true;

    soundEngine.playPowerOutage();

    if (this.officeData?.officeLights) {
      for (const light of this.officeData.officeLights) {
        if (light === this.officeData.generatorLight) {
          light.intensity = 2.4;
          (light as THREE.PointLight).color.setHex(0xef4444);
        } else {
          light.intensity = 0.03;
        }
      }
    }

    if (this.flashlight) {
      this.flashlight.intensity = 3.8;
      soundEngine.playFlashlightClick();
    }

    this.callbacks.onBlackoutChange?.(true);

    // IN THE BLACKOUT: Killers take opportunistic advantage to silently assassinate 1 or 2 employees!
    const victimsToKill = Math.random() < 0.5 ? 1 : 2;
    setTimeout(() => {
      if (this.isBlackoutActive && this.phase === 'PLAYING') {
        this.performStealthAssassination(victimsToKill, true);
      }
    }, 1200 + Math.random() * 2200);
  }

  /**
   * Stealth assassination of innocent employee when player isn't looking or during blackout.
   * STRICT RULE: Never kill too many employees, preserving a minimum pool of at least 5 innocents.
   */
  public performStealthAssassination(count: number = 1, isBlackoutContext: boolean = false) {
    const livingInnocents = this.npcs.filter(n => !n.profile.isMurderer && !n.isDead);
    // Never kill all employees to avoid raising too much suspicion
    if (livingInnocents.length <= 5) return;

    // Check maximum stealth kills per round
    const maxKillsAllowed = Math.min(3, 1 + Math.floor(this.phaseNumber / 3));
    if (this.stealthKillsCount >= maxKillsAllowed) return;

    const livingKillers = this.npcs.filter(n => n.profile.isMurderer && !n.isDead);
    if (livingKillers.length === 0) return;

    let killsDone = 0;
    const playerForward = new THREE.Vector3(0, 0, -1);
    playerForward.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')).normalize();

    for (const killer of livingKillers) {
      if (killsDone >= count) break;
      if (livingInnocents.length - killsDone <= 5) break;

      for (const victim of livingInnocents) {
        if (victim.isDead) continue;

        const distToPlayer = victim.group.position.distanceTo(this.playerPos);
        const distToKiller = victim.group.position.distanceTo(killer.group.position);

        const dirToVictim = victim.group.position.clone().sub(this.playerPos).normalize();
        const gazeDot = dirToVictim.dot(playerForward);

        let canAssassinate = false;
        if (isBlackoutContext) {
          // In blackout: assassin can strike in the shadows if outside direct flashlight cone or far
          canAssassinate = (gazeDot < 0.65 || distToPlayer > 8.0) && distToKiller < 8.0;
        } else {
          // Normal light: only when player is looking away (behind player or around a wall) or far (> 8m)
          canAssassinate = (gazeDot < 0.2 || distToPlayer > 8.5) && distToKiller < 5.0;
        }

        if (canAssassinate) {
          victim.triggerRagdoll(new THREE.Vector3((Math.random() - 0.5) * 0.4, -0.6, (Math.random() - 0.5) * 0.4));
          soundEngine.playHit(false);
          this.vfxList.push(createComicHitBurst(victim.group.position.clone(), this.scene, 'THUD!'));
          this.stealthKillsCount++;
          killsDone++;

          // Killer walks away to appear unsuspicious
          killer.state = 'WALKING_WAYPOINTS';
          break;
        }
      }
    }
  }

  public restorePower() {
    if (!this.isBlackoutActive) return;
    this.isBlackoutActive = false;

    soundEngine.playGeneratorStart();

    if (this.officeData?.officeLights) {
      for (const light of this.officeData.officeLights) {
        if (light === this.officeData.generatorLight) {
          light.intensity = 1.4;
          (light as THREE.PointLight).color.setHex(0x22c55e);
        } else {
          light.intensity = (light.type === 'AmbientLight') ? 0.75 : 1.2;
        }
      }
    }

    if (this.flashlight) {
      this.flashlight.intensity = 0;
      soundEngine.playFlashlightClick();
    }

    if (this.officeData?.generatorSwitchPos) {
      this.vfxList.push(createComicHitBurst(this.officeData.generatorSwitchPos.clone(), this.scene, '⚡ ENERGIA REATIVADA!'));
    }

    this.callbacks.onBlackoutChange?.(false);
  }

  private updateRaycasting() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);

    // Generator Console Proximity Check
    this.isHoveringGenerator = false;
    if (this.officeData?.generatorSwitchPos) {
      const distToGen = this.playerPos.distanceTo(this.officeData.generatorSwitchPos);
      if (distToGen < 3.2 && this.isBlackoutActive) {
        this.isHoveringGenerator = true;
        this.callbacks.onHoverProp('Reativar Gerador de Emergência (Pressione E)');
        return;
      }
    }

    let nearestProp: InteractiveProp | null = null;
    let minPropDist = 4.8;

    for (const prop of this.physicsWorld.props) {
      if (prop.isHeld) continue;
      const propPos = prop.mesh.position;
      const dist = this.playerPos.distanceTo(propPos);
      if (dist < minPropDist) {
        const hits = raycaster.intersectObject(prop.mesh, true);
        const rayPointDist = raycaster.ray.distanceToPoint(propPos);
        const forwardDot = new THREE.Vector3().subVectors(propPos, this.playerPos).normalize().dot(raycaster.ray.direction);

        // Generous pickup cone allows easily grabbing thrown items from the floor!
        if ((hits.length > 0 && hits[0].distance < minPropDist) || (rayPointDist < 1.15 && forwardDot > 0.3)) {
          nearestProp = prop;
          minPropDist = dist;
        }
      }
    }

    if (nearestProp !== this.hoveredProp) {
      this.hoveredProp = nearestProp;
      this.callbacks.onHoverProp(nearestProp ? nearestProp.name : null);
    }

    let nearestNPC: CharacterNPC | null = null;
    let minNPCDist = 7.0;

    for (const npc of this.npcs) {
      if (npc.isDead) continue;
      const npcPos = npc.group.position.clone();
      npcPos.y += 1.0;
      const dist = this.playerPos.distanceTo(npcPos);
      if (dist < minNPCDist) {
        const hits = raycaster.intersectObject(npc.group, true);
        const rayPointDist = raycaster.ray.distanceToPoint(npcPos);
        const forwardDot = new THREE.Vector3().subVectors(npcPos, this.playerPos).normalize().dot(raycaster.ray.direction);

        if ((hits.length > 0 && hits[0].distance < minNPCDist) || (rayPointDist < 0.85 && forwardDot > 0.7)) {
          nearestNPC = npc;
          minNPCDist = dist;
        }
      }
    }

    if (nearestNPC !== this.hoveredNPC) {
      this.hoveredNPC = nearestNPC;
      this.callbacks.onHoverEmployee(nearestNPC ? nearestNPC.profile : null);
    }
  }

  /**
   * Enhanced Agent AI for both Innocent Staff and Murderers
   * Makes all assassins smarter: evasion when watched, stalking in blackout, and flinching from flashlight.
   */
  private updateIntelligentAI(dt: number) {
    const now = this.clock.getElapsedTime();
    this.sweatSpawnTimer += dt;
    this.killerDecisionTimer -= dt;
    this.npcRoutineTimer -= dt;
    this.stealthAssassinationTimer -= dt;

    // Periodic check for stealth assassinations when player is looking away
    if (this.stealthAssassinationTimer <= 0) {
      this.stealthAssassinationTimer = 22 + Math.random() * 25;
      if (this.gameElapsedTime > 30) {
        this.performStealthAssassination(1, false);
      }
    }

    let closestDistance = 999;
    let closestIsMurderer = false;

    // Routine Waypoint Dispatch for idle staff (every 10-15s)
    if (this.npcRoutineTimer <= 0) {
      this.npcRoutineTimer = 8 + Math.random() * 8;
      const wanderer = this.npcs[Math.floor(Math.random() * this.npcs.length)];
      if (wanderer && !wanderer.isDead && wanderer.state === 'WORKING_DESK' && !wanderer.profile.isMurderer) {
        const isFloor2 = wanderer.group.position.y > 3.0;
        const targetNodes = isFloor2
          ? ['node-gen-console', 'node-gen-turbine1', 'node-gen-turbine2', 'node-floor2-hall']
          : ['node-break-counter', 'node-board-table', 'node-corridor-n', 'node-reception', 'node-stairs-bottom'];
        const chosenNode = targetNodes[Math.floor(Math.random() * targetNodes.length)];
        const path = navSystem.findPath(wanderer.group.position, chosenNode);
        wanderer.setPath(path);
      }
    }

    // Camera forward vector for player gaze check
    const playerForward = new THREE.Vector3(0, 0, -1);
    playerForward.applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')).normalize();

    // Killer Strategic Agenda for ALL living killers
    const livingKillers = this.npcs.filter(n => n.profile.isMurderer && !n.isDead);

    for (const killer of livingKillers) {
      const distToPlayer = killer.group.position.distanceTo(this.playerPos);
      const toKiller = killer.group.position.clone().sub(this.playerPos).normalize();
      const isPlayerLookingAtKiller = playerForward.dot(toKiller) > 0.65 && distToPlayer < 7.0;

      // Smart Behavior: When player approaches with a weapon or charging a throw
      if (isPlayerLookingAtKiller && (this.heldProp !== null || this.isChargingThrow)) {
        // Killer panics or evades!
        killer.walkSpeed = 2.8;
        killer.profile.nervousnessLevel = 1.0;
        if (killer.state !== 'WALKING_WAYPOINTS') {
          const isFloor2 = killer.group.position.y > 3.0;
          const evadeTargets = isFloor2
            ? ['node-stairs-top', 'node-gen-turbine1', 'node-gen-turbine2']
            : ['node-server-racks', 'node-break-counter', 'node-corridor-n', 'node-stairs-bottom'];
          const chosen = evadeTargets[Math.floor(Math.random() * evadeTargets.length)];
          killer.setPath(navSystem.findPath(killer.group.position, chosen));
        }
      }

      // Flashlight exposure in blackout: Killer flinches and bolts into darkness!
      if (this.isBlackoutActive && distToPlayer < 14.0 && playerForward.dot(toKiller) > 0.78) {
        killer.walkSpeed = 3.0;
        if (Math.random() < 0.3) {
          this.vfxList.push(createSweatDrop(killer.group.position.clone().add(new THREE.Vector3(0, 1.8, 0)), this.scene));
        }
      }
    }

    if (this.killerDecisionTimer <= 0) {
      this.killerDecisionTimer = 5 + Math.random() * 5;
      for (const killer of livingKillers) {
        const distToBoss = killer.group.position.distanceTo(this.playerPos);
        const isFloor2 = killer.group.position.y > 3.0;

        if (this.isBlackoutActive) {
          // In blackout, killers advance or reposition near stairs and generator
          killer.walkSpeed = 2.4;
          const blackoutTargets = isFloor2 
            ? ['node-gen-console', 'node-floor2-door']
            : ['node-stairs-bottom', 'node-reception', 'node-corridor-n'];
          const target = blackoutTargets[Math.floor(Math.random() * blackoutTargets.length)];
          killer.setPath(navSystem.findPath(killer.group.position, target));
        } else if (distToBoss < 5.0) {
          // If boss is too close, killer evades to blend with crowd
          killer.walkSpeed = 2.2;
          const evadeNodes = isFloor2
            ? ['node-gen-turbine1', 'node-floor2-hall']
            : ['node-server-racks', 'node-break-counter', 'node-board-table', 'node-stairs-bottom'];
          const target = evadeNodes[Math.floor(Math.random() * evadeNodes.length)];
          killer.setPath(navSystem.findPath(killer.group.position, target));
        } else if (killer.state === 'WORKING_DESK') {
          // Sneak to sabotage points (CEO desk, Server Room, or Generator room)
          const sabotageNodes = ['node-ceo-desk', 'node-server-racks', 'node-gen-console', 'node-stairs-bottom'];
          const sabotageNode = sabotageNodes[Math.floor(Math.random() * sabotageNodes.length)];
          killer.setPath(navSystem.findPath(killer.group.position, sabotageNode));
        }
      }
    }

    for (const npc of this.npcs) {
      npc.update(dt, this.playerPos);

      if (!npc.isDead) {
        const d = npc.group.position.distanceTo(this.playerPos);
        if (d < closestDistance) {
          closestDistance = d;
          closestIsMurderer = npc.profile.isMurderer;
        }

        if (npc.isNervous && this.sweatSpawnTimer > 0.8) {
          const headPos = npc.group.position.clone();
          headPos.y += 1.8;
          headPos.x += (Math.random() - 0.5) * 0.3;
          this.vfxList.push(createSweatDrop(headPos, this.scene));
        }
      }
    }

    if (this.sweatSpawnTimer > 0.8) {
      this.sweatSpawnTimer = 0;
    }

    if (closestDistance < 3.8 || this.timeLeft < 30) {
      const interval = closestIsMurderer ? 0.65 : (this.timeLeft < 30 ? 0.75 : 1.2);
      if (now - this.lastHeartbeatTime > interval) {
        this.lastHeartbeatTime = now;
        soundEngine.playHeartbeat();
      }
    }
  }

  public toggleMute(): boolean {
    const nextMuted = !soundEngine.getMuted();
    soundEngine.setMuted(nextMuted);
    return nextMuted;
  }

  public dispose() {
    cancelAnimationFrame(this.animationFrameId);
    soundEngine.stopAmbientMusic();
    this.trajectoryPredictor.dispose();
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}
