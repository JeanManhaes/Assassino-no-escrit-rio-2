import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { createCartoonMaterial } from './cartoonShaders';
import { EmployeeProfile, NPCBehaviorState } from './npcData';
import { soundEngine } from './audioEngine';
import { navSystem } from './pathfinding';

export interface RagdollPart {
  mesh: THREE.Mesh;
  body: CANNON.Body;
  offset: THREE.Vector3;
}

export class CharacterNPC {
  public group: THREE.Group;
  public profile: EmployeeProfile;
  public isDead: boolean = false;
  public isRagdollActive: boolean = false;

  // Visual Meshes
  public rootMesh: THREE.Group;
  public headMesh!: THREE.Mesh;
  public hairGroup!: THREE.Group;
  public torsoMesh!: THREE.Mesh;
  public pelvisMesh!: THREE.Mesh;
  public leftUpperArmMesh!: THREE.Mesh;
  public leftForearmMesh!: THREE.Mesh;
  public rightUpperArmMesh!: THREE.Mesh;
  public rightForearmMesh!: THREE.Mesh;
  public leftThighMesh!: THREE.Mesh;
  public leftCalfMesh!: THREE.Mesh;
  public rightThighMesh!: THREE.Mesh;
  public rightCalfMesh!: THREE.Mesh;
  public glassesMesh?: THREE.Mesh;

  // AI & Pathfinding State
  public state: NPCBehaviorState = 'WORKING_DESK';
  private stateTimer: number = Math.random() * 5;
  private animTimer: number = Math.random() * 10;
  public pathWaypoints: THREE.Vector3[] = [];
  public currentWaypointIndex: number = 0;
  public walkSpeed: number = 1.6;
  public isNervous: boolean = false;
  public targetLookPos: THREE.Vector3 | null = null;

  // Ragdoll Physics
  public ragdollParts: RagdollPart[] = [];
  public constraints: CANNON.Constraint[] = [];
  private physicsWorld: CANNON.World;
  public kinematicBody: CANNON.Body;

  constructor(
    profile: EmployeeProfile,
    pos: THREE.Vector3,
    scene: THREE.Scene,
    physicsWorld: CANNON.World
  ) {
    this.profile = profile;
    this.physicsWorld = physicsWorld;
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    scene.add(this.group);

    this.rootMesh = new THREE.Group();
    this.group.add(this.rootMesh);

    this.buildCharacterMeshes();

    const charShape = new CANNON.Cylinder(0.38, 0.38, 1.7, 8);
    this.kinematicBody = new CANNON.Body({
      mass: 0,
      type: CANNON.Body.KINEMATIC,
      shape: charShape,
      position: new CANNON.Vec3(pos.x, pos.y + 0.85, pos.z),
    });
    this.physicsWorld.addBody(this.kinematicBody);
  }

  private buildCharacterMeshes() {
    const { attireColor, hairStyle, hasGlasses } = this.profile;

    const skinMat = createCartoonMaterial({ color: attireColor.skin });
    const shirtMat = createCartoonMaterial({ color: attireColor.shirt });
    const pantsMat = createCartoonMaterial({ color: attireColor.pants });
    const shoesMat = createCartoonMaterial({ color: attireColor.shoes });
    const hairMat = createCartoonMaterial({ color: attireColor.hair });
    const metalMat = createCartoonMaterial({ color: 0xd4d4d8 });
    const darkMat = createCartoonMaterial({ color: 0x09090b });

    // 1. Pelvis / Hips (Y = 0.85)
    const pelvisGeo = new THREE.BoxGeometry(0.38, 0.22, 0.26);
    this.pelvisMesh = new THREE.Mesh(pelvisGeo, pantsMat);
    this.pelvisMesh.position.set(0, 0.85, 0);
    this.pelvisMesh.castShadow = true;
    this.rootMesh.add(this.pelvisMesh);

    // Belt with buckle
    const beltGeo = new THREE.BoxGeometry(0.39, 0.04, 0.27);
    const beltMesh = new THREE.Mesh(beltGeo, darkMat);
    beltMesh.position.set(0, 0.1, 0);
    this.pelvisMesh.add(beltMesh);
    const buckleGeo = new THREE.BoxGeometry(0.08, 0.05, 0.02);
    const buckleMesh = new THREE.Mesh(buckleGeo, metalMat);
    buckleMesh.position.set(0, 0, 0.14);
    beltMesh.add(buckleMesh);

    // 2. Torso / Chest (Y = 1.15)
    const torsoGeo = new THREE.BoxGeometry(0.44, 0.44, 0.28);
    this.torsoMesh = new THREE.Mesh(torsoGeo, shirtMat);
    this.torsoMesh.position.set(0, 1.15, 0);
    this.torsoMesh.castShadow = true;
    this.rootMesh.add(this.torsoMesh);

    // Shirt collar
    const collarGeo = new THREE.BoxGeometry(0.24, 0.06, 0.12);
    const collarMesh = new THREE.Mesh(collarGeo, shirtMat);
    collarMesh.position.set(0, 0.22, 0.08);
    this.torsoMesh.add(collarMesh);

    // Check if character is a police officer or security agent
    const isLawEnforcement = this.profile.role.toLowerCase().includes('políci') || 
                             this.profile.role.toLowerCase().includes('perit') ||
                             this.profile.role.toLowerCase().includes('segurança');

    if (isLawEnforcement) {
      // Golden/Silver Police Shield Badge on Chest
      const goldMat = createCartoonMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.35 });
      const policeBadgeGeo = new THREE.BoxGeometry(0.09, 0.11, 0.03);
      const policeBadge = new THREE.Mesh(policeBadgeGeo, goldMat);
      policeBadge.position.set(0.12, 0.08, 0.155);
      this.torsoMesh.add(policeBadge);

      // Tactical radio shoulder mic
      const radioMicGeo = new THREE.BoxGeometry(0.06, 0.08, 0.05);
      const radioMic = new THREE.Mesh(radioMicGeo, darkMat);
      radioMic.position.set(-0.16, 0.18, 0.12);
      this.torsoMesh.add(radioMic);

      // Tactical Duty Belt with Gun Holster on Pelvis
      const holsterGeo = new THREE.BoxGeometry(0.08, 0.16, 0.1);
      const holster = new THREE.Mesh(holsterGeo, darkMat);
      holster.position.set(0.22, -0.02, 0.04);
      this.pelvisMesh.add(holster);
    } else {
      // Tie or Employee Badge Lanyard
      const tieGeo = new THREE.BoxGeometry(0.08, 0.26, 0.03);
      const tieMat = createCartoonMaterial({ color: attireColor.accessory || 0xdc2626 });
      const tieMesh = new THREE.Mesh(tieGeo, tieMat);
      tieMesh.position.set(0, -0.04, 0.15);
      this.torsoMesh.add(tieMesh);

      // Employee ID Card hanging on chest
      const badgeGeo = new THREE.BoxGeometry(0.08, 0.1, 0.02);
      const badgeMat = createCartoonMaterial({ color: 0xffffff });
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.position.set(0.14, 0.06, 0.15);
      this.torsoMesh.add(badgeMesh);
    }

    // Neck - attached to Torso so it ragdolls naturally with physics
    const neckGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.12, 8);
    const neckMesh = new THREE.Mesh(neckGeo, skinMat);
    neckMesh.position.set(0, 0.26, 0);
    this.torsoMesh.add(neckMesh);

    // 3. Head (Y = 1.58)
    const headGeo = new THREE.BoxGeometry(0.32, 0.34, 0.3);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.set(0, 1.58, 0);
    this.headMesh.castShadow = true;
    this.rootMesh.add(this.headMesh);

    // Sculpted Cartoon Nose with Bridge
    const noseGeo = new THREE.BoxGeometry(0.045, 0.08, 0.05);
    const nose = new THREE.Mesh(noseGeo, skinMat);
    nose.position.set(0, -0.01, 0.175);
    this.headMesh.add(nose);

    // Mouth / Smirk Line
    const mouthGeo = new THREE.BoxGeometry(0.08, 0.015, 0.01);
    const mouthMat = createCartoonMaterial({ color: 0x881337 });
    const mouth = new THREE.Mesh(mouthGeo, mouthMat);
    mouth.position.set(0, -0.09, 0.155);
    this.headMesh.add(mouth);

    // Cartoon Ears with Inner Recess
    const earGeo = new THREE.BoxGeometry(0.04, 0.08, 0.06);
    const innerEarGeo = new THREE.BoxGeometry(0.02, 0.05, 0.03);
    const innerEarMat = createCartoonMaterial({ color: 0x9f1239 });

    const earL = new THREE.Mesh(earGeo, skinMat);
    earL.position.set(-0.18, 0, 0);
    const inL = new THREE.Mesh(innerEarGeo, innerEarMat);
    inL.position.set(-0.01, 0, 0.01);
    earL.add(inL);

    const earR = new THREE.Mesh(earGeo, skinMat);
    earR.position.set(0.18, 0, 0);
    const inR = new THREE.Mesh(innerEarGeo, innerEarMat);
    inR.position.set(0.01, 0, 0.01);
    earR.add(inR);

    this.headMesh.add(earL);
    this.headMesh.add(earR);

    // Cartoon Eyes with White Sclera, Iris, Pupil & Specular Shine Dot
    const eyeWhiteGeo = new THREE.BoxGeometry(0.075, 0.085, 0.03);
    const eyeWhiteMat = createCartoonMaterial({ color: 0xffffff });
    const irisColors = [0x1e3a8a, 0x15803d, 0x78350f, 0x0f172a];
    const irisColor = irisColors[Math.floor(Math.random() * irisColors.length)];
    const irisGeo = new THREE.BoxGeometry(0.05, 0.06, 0.02);
    const irisMat = createCartoonMaterial({ color: irisColor });
    const pupilGeo = new THREE.BoxGeometry(0.03, 0.04, 0.015);
    const pupilMat = createCartoonMaterial({ color: 0x09090b });
    const shineGeo = new THREE.BoxGeometry(0.012, 0.012, 0.01);
    const shineMat = createCartoonMaterial({ color: 0xffffff });

    const makeEye = (x: number) => {
      const eyeGroup = new THREE.Group();
      eyeGroup.position.set(x, 0.03, 0.155);
      eyeGroup.add(new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat));

      const iris = new THREE.Mesh(irisGeo, irisMat);
      iris.position.z = 0.012;
      eyeGroup.add(iris);

      const pup = new THREE.Mesh(pupilGeo, pupilMat);
      pup.position.z = 0.02;
      eyeGroup.add(pup);

      const shine = new THREE.Mesh(shineGeo, shineMat);
      shine.position.set(0.01, 0.01, 0.025);
      eyeGroup.add(shine);

      return eyeGroup;
    };

    this.headMesh.add(makeEye(-0.08));
    this.headMesh.add(makeEye(0.08));

    // Eyebrows
    const browGeo = new THREE.BoxGeometry(0.09, 0.025, 0.02);
    const browL = new THREE.Mesh(browGeo, hairMat);
    browL.position.set(-0.08, 0.11, 0.16);
    const browR = new THREE.Mesh(browGeo, hairMat);
    browR.position.set(0.08, 0.11, 0.16);
    this.headMesh.add(browL);
    this.headMesh.add(browR);

    // Glasses Accessory if applicable
    if (hasGlasses) {
      const glassesGeo = new THREE.BoxGeometry(0.28, 0.08, 0.05);
      const glassesMat = createCartoonMaterial({ color: 0x1e293b });
      this.glassesMesh = new THREE.Mesh(glassesGeo, glassesMat);
      this.glassesMesh.position.set(0, 0.03, 0.17);
      this.headMesh.add(this.glassesMesh);
    }

    // Hairstyles Generator
    this.hairGroup = new THREE.Group();
    this.headMesh.add(this.hairGroup);

    if (hairStyle === 'curly') {
      for (let i = 0; i < 7; i++) {
        const puffGeo = new THREE.DodecahedronGeometry(0.12, 1);
        const puff = new THREE.Mesh(puffGeo, hairMat);
        puff.position.set((Math.random() - 0.5) * 0.28, 0.18 + Math.random() * 0.06, (Math.random() - 0.5) * 0.24);
        this.hairGroup.add(puff);
      }
    } else if (hairStyle === 'ponytail') {
      const capGeo = new THREE.BoxGeometry(0.35, 0.16, 0.34);
      const cap = new THREE.Mesh(capGeo, hairMat);
      cap.position.set(0, 0.15, -0.02);
      this.hairGroup.add(cap);

      const tailGeo = new THREE.CylinderGeometry(0.06, 0.04, 0.32, 8);
      const tail = new THREE.Mesh(tailGeo, hairMat);
      tail.position.set(0, 0.1, -0.22);
      tail.rotation.x = -0.4;
      this.hairGroup.add(tail);
    } else if (hairStyle === 'slick') {
      const slickGeo = new THREE.BoxGeometry(0.36, 0.12, 0.36);
      const slick = new THREE.Mesh(slickGeo, hairMat);
      slick.position.set(0, 0.18, -0.02);
      this.hairGroup.add(slick);
    } else if (hairStyle === 'afro') {
      const afroGeo = new THREE.SphereGeometry(0.26, 8, 8);
      const afro = new THREE.Mesh(afroGeo, hairMat);
      afro.position.set(0, 0.2, 0);
      this.hairGroup.add(afro);
    } else if (hairStyle === 'short') {
      const shortGeo = new THREE.BoxGeometry(0.36, 0.16, 0.34);
      const shortHair = new THREE.Mesh(shortGeo, hairMat);
      shortHair.position.set(0, 0.16, 0);
      this.hairGroup.add(shortHair);
    }

    // Police Cap (Quepe Oficial) for Law Enforcement Officers
    if (isLawEnforcement) {
      const capGroup = new THREE.Group();
      capGroup.position.set(0, 0.17, 0);

      // Navy Blue Cap Crown
      const capCrownGeo = new THREE.CylinderGeometry(0.2, 0.17, 0.12, 12);
      const capCrownMat = createCartoonMaterial({ color: 0x0f172a });
      const capCrown = new THREE.Mesh(capCrownGeo, capCrownMat);
      capGroup.add(capCrown);

      // Black Visor / Pala
      const visorGeo = new THREE.BoxGeometry(0.24, 0.02, 0.1);
      const visorMat = createCartoonMaterial({ color: 0x09090b });
      const visor = new THREE.Mesh(visorGeo, visorMat);
      visor.position.set(0, -0.05, 0.18);
      visor.rotation.x = 0.2;
      capGroup.add(visor);

      // Gold Police Crest Badge on Cap
      const crestGeo = new THREE.BoxGeometry(0.06, 0.06, 0.02);
      const crestMat = createCartoonMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.4 });
      const crest = new THREE.Mesh(crestGeo, crestMat);
      crest.position.set(0, 0.02, 0.19);
      capGroup.add(crest);

      this.headMesh.add(capGroup);
    }

    // 4. Arms
    const armGeo = new THREE.BoxGeometry(0.13, 0.24, 0.13);
    const forearmGeo = new THREE.BoxGeometry(0.11, 0.22, 0.11);

    this.leftUpperArmMesh = new THREE.Mesh(armGeo, shirtMat);
    this.leftUpperArmMesh.position.set(-0.29, 1.25, 0);
    this.rootMesh.add(this.leftUpperArmMesh);

    this.leftForearmMesh = new THREE.Mesh(forearmGeo, skinMat);
    this.leftForearmMesh.position.set(-0.29, 1.02, 0);

    // Corporate Executive Wristwatch
    const watchStrap = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.12), darkMat);
    watchStrap.position.set(0, -0.05, 0);
    const watchFace = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), metalMat);
    watchFace.position.set(0, 0, 0.06);
    watchStrap.add(watchFace);
    this.leftForearmMesh.add(watchStrap);

    this.rootMesh.add(this.leftForearmMesh);

    this.rightUpperArmMesh = new THREE.Mesh(armGeo, shirtMat);
    this.rightUpperArmMesh.position.set(0.29, 1.25, 0);
    this.rootMesh.add(this.rightUpperArmMesh);

    this.rightForearmMesh = new THREE.Mesh(forearmGeo, skinMat);
    this.rightForearmMesh.position.set(0.29, 1.02, 0);
    this.rootMesh.add(this.rightForearmMesh);

    // 5. Legs
    const thighGeo = new THREE.BoxGeometry(0.16, 0.36, 0.16);
    const calfGeo = new THREE.BoxGeometry(0.15, 0.36, 0.17);

    this.leftThighMesh = new THREE.Mesh(thighGeo, pantsMat);
    this.leftThighMesh.position.set(-0.12, 0.58, 0);
    this.rootMesh.add(this.leftThighMesh);

    this.leftCalfMesh = new THREE.Mesh(calfGeo, shoesMat);
    this.leftCalfMesh.position.set(-0.12, 0.22, 0.02);
    this.rootMesh.add(this.leftCalfMesh);

    this.rightThighMesh = new THREE.Mesh(thighGeo, pantsMat);
    this.rightThighMesh.position.set(0.12, 0.58, 0);
    this.rootMesh.add(this.rightThighMesh);

    this.rightCalfMesh = new THREE.Mesh(calfGeo, shoesMat);
    this.rightCalfMesh.position.set(0.12, 0.22, 0.02);
    this.rootMesh.add(this.rightCalfMesh);
  }

  public setPath(waypoints: THREE.Vector3[]) {
    this.pathWaypoints = waypoints;
    this.currentWaypointIndex = 0;
    this.state = 'WALKING_WAYPOINTS';
  }

  public triggerRagdoll(impactForce: THREE.Vector3) {
    if (this.isRagdollActive) return;
    this.isRagdollActive = true;
    this.isDead = true;

    this.physicsWorld.removeBody(this.kinematicBody);

    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const parentScene = this.group.parent || this.group;

    // Immediately hide empty root container so no unattached helper meshes float
    this.rootMesh.visible = false;

    const createLimbBody = (
      mesh: THREE.Mesh,
      shape: CANNON.Shape,
      mass: number
    ): CANNON.Body => {
      mesh.getWorldPosition(worldPos);
      mesh.getWorldQuaternion(worldQuat);

      parentScene.attach(mesh);

      const body = new CANNON.Body({
        mass,
        shape,
        position: new CANNON.Vec3(worldPos.x, worldPos.y, worldPos.z),
        quaternion: new CANNON.Quaternion(worldQuat.x, worldQuat.y, worldQuat.z, worldQuat.w),
        linearDamping: 0.2,
        angularDamping: 0.3,
      });

      this.physicsWorld.addBody(body);
      this.ragdollParts.push({ mesh, body, offset: new THREE.Vector3() });
      return body;
    };

    const pelvisBody = createLimbBody(this.pelvisMesh, new CANNON.Box(new CANNON.Vec3(0.19, 0.11, 0.13)), 18);
    const torsoBody = createLimbBody(this.torsoMesh, new CANNON.Box(new CANNON.Vec3(0.22, 0.22, 0.14)), 24);
    const headBody = createLimbBody(this.headMesh, new CANNON.Sphere(0.18), 6);

    const lUpperArmBody = createLimbBody(this.leftUpperArmMesh, new CANNON.Box(new CANNON.Vec3(0.06, 0.12, 0.06)), 4);
    const rUpperArmBody = createLimbBody(this.rightUpperArmMesh, new CANNON.Box(new CANNON.Vec3(0.06, 0.12, 0.06)), 4);
    const lForearmBody = createLimbBody(this.leftForearmMesh, new CANNON.Box(new CANNON.Vec3(0.05, 0.11, 0.05)), 3);
    const rForearmBody = createLimbBody(this.rightForearmMesh, new CANNON.Box(new CANNON.Vec3(0.05, 0.11, 0.05)), 3);

    const lThighBody = createLimbBody(this.leftThighMesh, new CANNON.Box(new CANNON.Vec3(0.08, 0.18, 0.08)), 8);
    const rThighBody = createLimbBody(this.rightThighMesh, new CANNON.Box(new CANNON.Vec3(0.08, 0.18, 0.08)), 8);
    const lCalfBody = createLimbBody(this.leftCalfMesh, new CANNON.Box(new CANNON.Vec3(0.07, 0.18, 0.08)), 6);
    const rCalfBody = createLimbBody(this.rightCalfMesh, new CANNON.Box(new CANNON.Vec3(0.07, 0.18, 0.08)), 6);

    const addJoint = (
      bodyA: CANNON.Body,
      bodyB: CANNON.Body,
      pivotA: CANNON.Vec3,
      pivotB: CANNON.Vec3
    ) => {
      const constraint = new CANNON.PointToPointConstraint(bodyA, pivotA, bodyB, pivotB);
      this.physicsWorld.addConstraint(constraint);
      this.constraints.push(constraint);
    };

    addJoint(pelvisBody, torsoBody, new CANNON.Vec3(0, 0.11, 0), new CANNON.Vec3(0, -0.22, 0));
    addJoint(torsoBody, headBody, new CANNON.Vec3(0, 0.22, 0), new CANNON.Vec3(0, -0.17, 0));
    addJoint(torsoBody, lUpperArmBody, new CANNON.Vec3(-0.26, 0.18, 0), new CANNON.Vec3(0, 0.12, 0));
    addJoint(torsoBody, rUpperArmBody, new CANNON.Vec3(0.26, 0.18, 0), new CANNON.Vec3(0, 0.12, 0));
    addJoint(lUpperArmBody, lForearmBody, new CANNON.Vec3(0, -0.12, 0), new CANNON.Vec3(0, 0.11, 0));
    addJoint(rUpperArmBody, rForearmBody, new CANNON.Vec3(0, -0.12, 0), new CANNON.Vec3(0, 0.11, 0));
    addJoint(pelvisBody, lThighBody, new CANNON.Vec3(-0.12, -0.11, 0), new CANNON.Vec3(0, 0.18, 0));
    addJoint(pelvisBody, rThighBody, new CANNON.Vec3(0.12, -0.11, 0), new CANNON.Vec3(0, 0.18, 0));
    addJoint(lThighBody, lCalfBody, new CANNON.Vec3(0, -0.18, 0), new CANNON.Vec3(0, 0.18, 0));
    addJoint(rThighBody, rCalfBody, new CANNON.Vec3(0, -0.18, 0), new CANNON.Vec3(0, 0.18, 0));

    const impulse = new CANNON.Vec3(impactForce.x * 40, impactForce.y * 35 + 24, impactForce.z * 40);
    torsoBody.applyImpulse(impulse, torsoBody.position);
    headBody.applyImpulse(new CANNON.Vec3(impulse.x * 0.9, impulse.y * 0.6, impulse.z * 0.9), headBody.position);

    soundEngine.playHit(true);
  }

  public update(dt: number, playerPos: THREE.Vector3) {
    if (this.isRagdollActive) {
      for (const part of this.ragdollParts) {
        part.mesh.position.set(part.body.position.x, part.body.position.y, part.body.position.z);
        part.mesh.quaternion.set(part.body.quaternion.x, part.body.quaternion.y, part.body.quaternion.z, part.body.quaternion.w);
      }
      return;
    }

    this.animTimer += dt;
    this.stateTimer -= dt;

    const distToPlayer = this.group.position.distanceTo(playerPos);
    this.isNervous = (distToPlayer < 4.2 && this.profile.nervousnessLevel > 0.4);

    // Look at player if very close, otherwise look at target task
    if (distToPlayer < 5.0) {
      const lookVec = new THREE.Vector3().subVectors(playerPos, this.group.position).normalize();
      const targetAngle = Math.atan2(lookVec.x, lookVec.z);
      this.group.rotation.y = THREE.MathUtils.damp(this.group.rotation.y, targetAngle, 4, dt);
    }

    // AI Behavioral State Machine
    if (this.state === 'WALKING_WAYPOINTS') {
      if (this.pathWaypoints.length > 0 && this.currentWaypointIndex < this.pathWaypoints.length) {
        const targetWp = this.pathWaypoints[this.currentWaypointIndex];
        const dir = new THREE.Vector3().subVectors(targetWp, this.group.position);
        dir.y = 0;
        const dist = dir.length();

        if (dist > 0.3) {
          dir.normalize();
          this.group.position.addScaledVector(dir, this.walkSpeed * dt);
          this.group.rotation.y = Math.atan2(dir.x, dir.z);

          // Fluid walk stride
          const stride = Math.sin(this.animTimer * 8.5);
          this.leftThighMesh.rotation.x = stride * 0.55;
          this.rightThighMesh.rotation.x = -stride * 0.55;
          this.leftCalfMesh.rotation.x = Math.max(0, -stride * 0.45);
          this.rightCalfMesh.rotation.x = Math.max(0, stride * 0.45);

          this.leftUpperArmMesh.rotation.x = -stride * 0.45;
          this.rightUpperArmMesh.rotation.x = stride * 0.45;

          this.pelvisMesh.position.y = 0.85 + Math.abs(stride) * 0.04;
          this.torsoMesh.position.y = 1.15 + Math.abs(stride) * 0.04;
        } else {
          this.currentWaypointIndex++;
          if (this.currentWaypointIndex >= this.pathWaypoints.length) {
            // Arrived at destination task
            this.state = (Math.random() < 0.5) ? 'WORKING_DESK' : 'COFFEE_BREAK';
            this.stateTimer = 6 + Math.random() * 12;
            this.pathWaypoints = [];
          }
        }
      }
    } else if (this.state === 'WORKING_DESK') {
      // Fluid typing & desk work animation
      const typeSwing = Math.sin(this.animTimer * 12);
      this.leftUpperArmMesh.rotation.x = 0.7 + typeSwing * 0.1;
      this.rightUpperArmMesh.rotation.x = 0.7 - typeSwing * 0.1;
      this.leftForearmMesh.rotation.x = 0.6;
      this.rightForearmMesh.rotation.x = 0.6;

      const breath = Math.sin(this.animTimer * 2.5) * 0.015;
      this.torsoMesh.position.y = 1.15 + breath;
      this.headMesh.position.y = 1.58 + breath;
      this.headMesh.rotation.x = 0.15; // head tilted looking at screen

      this.leftThighMesh.rotation.x = 0;
      this.rightThighMesh.rotation.x = 0;
      this.leftCalfMesh.rotation.x = 0;
      this.rightCalfMesh.rotation.x = 0;
    } else if (this.state === 'COFFEE_BREAK') {
      // Standing and sipping coffee
      const sip = Math.sin(this.animTimer * 1.5);
      this.rightUpperArmMesh.rotation.x = 0.8 + sip * 0.2;
      this.rightForearmMesh.rotation.x = 0.8;
      this.leftUpperArmMesh.rotation.x = 0;
      this.leftForearmMesh.rotation.x = 0;
    }

    // Fidgeting & shivering when nervous near the boss
    if (this.isNervous) {
      const jitter = Math.sin(this.animTimer * 28) * 0.03;
      this.headMesh.rotation.z = jitter;
      this.leftUpperArmMesh.rotation.z = jitter * 1.6;
      this.rightUpperArmMesh.rotation.z = -jitter * 1.6;
    } else {
      this.headMesh.rotation.z = 0;
    }

    // STRICT ANTI-CLIPPING COLLISION RESOLUTION: Physically push out of walls & furniture!
    navSystem.resolveAllCollisions(this.group.position, 0.42);

    // Hard boundary clamp so NPCs never fall through or glitch outside exterior perimeter
    this.group.position.x = Math.max(-22.2, Math.min(22.2, this.group.position.x));
    this.group.position.z = Math.max(-16.2, Math.min(16.2, this.group.position.z));

    // Sync kinematic collision body
    this.kinematicBody.position.set(
      this.group.position.x,
      this.group.position.y + 0.85,
      this.group.position.z
    );
  }

  public dispose() {
    this.physicsWorld.removeBody(this.kinematicBody);
    for (const constraint of this.constraints) {
      this.physicsWorld.removeConstraint(constraint);
    }
    for (const part of this.ragdollParts) {
      this.physicsWorld.removeBody(part.body);
      // Cleanly remove detached ragdoll limb mesh from scene
      if (part.mesh.parent) {
        part.mesh.parent.remove(part.mesh);
      }
    }
    this.constraints = [];
    this.ragdollParts = [];

    // Remove character root group from scene
    if (this.group.parent) {
      this.group.parent.remove(this.group);
    }
  }
}
