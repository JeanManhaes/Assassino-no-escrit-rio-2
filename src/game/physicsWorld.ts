import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { soundEngine } from './audioEngine';

/**
 * 3D Physics World powered by Cannon-es
 * Handles realistic collisions, throwing, furniture physics and rigid body simulation.
 */

export type WeaponPropType = 
  | 'pen' 
  | 'stapler' 
  | 'chair' 
  | 'mug' 
  | 'extinguisher' 
  | 'keyboard' 
  | 'scissors'
  | 'thermos'
  | 'monitor'
  | 'clipboard'
  | 'wastebasket'
  | 'holepunch'
  | 'book'
  | 'umbrella'
  | 'knife'
  | 'slingshot'
  | 'whip'
  | 'pistol'
  | 'revolver'
  | 'laser_gun'
  | 'stun_baton'
  | 'crossbow'
  | 'sledgehammer'
  | 'katana'
  | 'plasma_rifle';

export interface InteractiveProp {
  id: string;
  name: string;
  type: WeaponPropType;
  mesh: THREE.Group | THREE.Mesh;
  body: CANNON.Body;
  isHeld: boolean;
  damage: number;
  weightCategory: 'light' | 'medium' | 'heavy';
  lastThrowTime?: number;
}

export class PhysicsWorld {
  public world: CANNON.World;
  public props: InteractiveProp[] = [];
  public staticColliders: CANNON.Body[] = [];
  private defaultMaterial: CANNON.Material;
  private bouncyMaterial: CANNON.Material;

  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, -18, 0),
    });
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 10;
    this.world.allowSleep = true;

    this.defaultMaterial = new CANNON.Material('default');
    this.bouncyMaterial = new CANNON.Material('bouncy');

    const contactMat = new CANNON.ContactMaterial(this.defaultMaterial, this.defaultMaterial, {
      friction: 0.45,
      restitution: 0.18,
    });
    const bouncyContactMat = new CANNON.ContactMaterial(this.defaultMaterial, this.bouncyMaterial, {
      friction: 0.35,
      restitution: 0.4,
    });

    this.world.addContactMaterial(contactMat);
    this.world.addContactMaterial(bouncyContactMat);

    this.ensureGroundPlane();
  }

  public ensureGroundPlane() {
    // Only add if not already present
    const hasGround = this.staticColliders.some(b => b.shapes.some(s => s instanceof CANNON.Plane));
    if (!hasGround) {
      const groundBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Plane(),
        material: this.defaultMaterial,
      });
      groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
      this.world.addBody(groundBody);
      this.staticColliders.push(groundBody);
    }
  }

  public addStaticBox(pos: THREE.Vector3, halfExtents: THREE.Vector3): CANNON.Body {
    const body = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Box(new CANNON.Vec3(halfExtents.x, halfExtents.y, halfExtents.z)),
      position: new CANNON.Vec3(pos.x, pos.y, pos.z),
      material: this.defaultMaterial,
    });
    this.world.addBody(body);
    this.staticColliders.push(body);
    return body;
  }

  public registerProp(prop: InteractiveProp) {
    this.props.push(prop);
    this.world.addBody(prop.body);

    // Collision sound listener
    prop.body.addEventListener('collide', (e: { contact: CANNON.ContactEquation }) => {
      const impactVelocity = e.contact.getImpactVelocityAlongNormal();
      if (Math.abs(impactVelocity) > 2.2) {
        if (prop.type === 'stapler') {
          soundEngine.playStaplerSnap();
        } else if (prop.type === 'scissors' || prop.type === 'knife' || prop.type === 'katana') {
          soundEngine.playScissorsSnip();
        } else if (prop.type === 'wastebasket' || prop.type === 'thermos' || prop.type === 'holepunch' || prop.type === 'extinguisher' || prop.type === 'revolver' || prop.type === 'pistol' || prop.type === 'sledgehammer') {
          soundEngine.playMetallicGong();
        } else if ((prop.type === 'mug' || prop.type === 'monitor') && Math.abs(impactVelocity) > 4.5) {
          soundEngine.playShatter();
        } else {
          soundEngine.playHit(false);
        }
      }
    });
  }

  public removeProp(prop: InteractiveProp) {
    const idx = this.props.indexOf(prop);
    if (idx !== -1) {
      this.props.splice(idx, 1);
    }
    this.world.removeBody(prop.body);
  }

  public step(dt: number) {
    const clampedDt = Math.min(dt, 0.05);
    this.world.step(1 / 60, clampedDt, 3);

    for (const prop of this.props) {
      if (!prop.isHeld) {
        // Floor 2 collision retention clamp: technical substation floor
        const isOverFloor2 = (
          prop.body.position.x >= -6.0 && 
          prop.body.position.x <= 23.0 && 
          prop.body.position.z >= -17.0 && 
          prop.body.position.z <= 7.0
        );

        if (isOverFloor2 && prop.body.position.y > 3.6 && prop.body.position.y < 4.02) {
          prop.body.position.y = 4.04;
          if (prop.body.velocity.y < 0) {
            prop.body.velocity.y = 0;
            prop.body.velocity.x *= 0.88;
            prop.body.velocity.z *= 0.88;
          }
        } else if (prop.body.position.y < 0.03) {
          // Floor 1 ground retention clamp: items ALWAYS remain accessible on carpet
          prop.body.position.y = 0.04;
          if (prop.body.velocity.y < 0) {
            prop.body.velocity.y = 0;
            prop.body.velocity.x *= 0.88;
            prop.body.velocity.z *= 0.88;
          }
        }

        prop.mesh.position.set(
          prop.body.position.x,
          prop.body.position.y,
          prop.body.position.z
        );
        prop.mesh.quaternion.set(
          prop.body.quaternion.x,
          prop.body.quaternion.y,
          prop.body.quaternion.z,
          prop.body.quaternion.w
        );
      }
    }
  }

  public clear() {
    for (const prop of this.props) {
      this.world.removeBody(prop.body);
    }
    this.props = [];
    for (const body of this.staticColliders) {
      this.world.removeBody(body);
    }
    this.staticColliders = [];
    // Ensure ground plane is never lost when restarting or advancing phases
    this.ensureGroundPlane();
  }
}
