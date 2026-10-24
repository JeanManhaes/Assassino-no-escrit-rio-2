import * as THREE from 'three';

/**
 * 3D Parabolic Trajectory Predictor & Ground Landing Indicator
 * Shows dynamic arc and landing ring when player holds Right Click to charge throw.
 */

export class TrajectoryPredictor {
  private lineMesh: THREE.Line;
  private targetRing: THREE.Mesh;
  private maxPoints: number = 40;
  private pointsArray: Float32Array;
  private scene: THREE.Scene;
  public isVisible: boolean = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.pointsArray = new Float32Array(this.maxPoints * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pointsArray, 3));

    const lineMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      linewidth: 3,
      transparent: true,
      opacity: 0.85,
    });
    this.lineMesh = new THREE.Line(geo, lineMat);
    this.lineMesh.visible = false;
    this.scene.add(this.lineMesh);

    // Landing Ring on floor
    const ringGeo = new THREE.RingGeometry(0.25, 0.42, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8,
    });
    this.targetRing = new THREE.Mesh(ringGeo, ringMat);
    this.targetRing.rotation.x = -Math.PI / 2;
    this.targetRing.visible = false;
    this.scene.add(this.targetRing);
  }

  public updateTrajectory(
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    power: number,
    weightCategory: 'light' | 'medium' | 'heavy'
  ) {
    this.isVisible = true;
    this.lineMesh.visible = true;
    this.targetRing.visible = true;

    const baseSpeed = weightCategory === 'light' ? 36 : (weightCategory === 'medium' ? 26 : 18);
    const throwVelocity = direction.clone().multiplyScalar(baseSpeed * (0.6 + power * 0.75));
    throwVelocity.y += 2.2 + power * 1.5;

    const gravity = -18; // matching physics world
    const dt = 0.04;

    const simPos = origin.clone();
    let hitFloor = false;
    let impactPos = simPos.clone();

    for (let i = 0; i < this.maxPoints; i++) {
      this.pointsArray[i * 3] = simPos.x;
      this.pointsArray[i * 3 + 1] = simPos.y;
      this.pointsArray[i * 3 + 2] = simPos.z;

      if (!hitFloor) {
        simPos.x += throwVelocity.x * dt;
        simPos.y += throwVelocity.y * dt + 0.5 * gravity * dt * dt;
        simPos.z += throwVelocity.z * dt;
        throwVelocity.y += gravity * dt;

        if (simPos.y <= 0.05) {
          simPos.y = 0.05;
          hitFloor = true;
          impactPos = simPos.clone();
        }
      }
    }

    this.lineMesh.geometry.attributes.position.needsUpdate = true;

    // Position landing marker
    this.targetRing.position.set(impactPos.x, 0.04, impactPos.z);
    const ringScale = 0.8 + power * 0.6;
    this.targetRing.scale.set(ringScale, ringScale, ringScale);

    // Color gradient based on charge level
    const lineMat = this.lineMesh.material as THREE.LineBasicMaterial;
    if (power > 0.8) {
      lineMat.color.setHex(0xf43f5e); // Hot red when fully charged
    } else if (power > 0.4) {
      lineMat.color.setHex(0xfbbf24); // Warm amber
    } else {
      lineMat.color.setHex(0x38bdf8); // Cool blue
    }
  }

  public hide() {
    this.isVisible = false;
    this.lineMesh.visible = false;
    this.targetRing.visible = false;
  }

  public dispose() {
    this.scene.remove(this.lineMesh);
    this.scene.remove(this.targetRing);
    this.lineMesh.geometry.dispose();
    (this.lineMesh.material as THREE.Material).dispose();
    this.targetRing.geometry.dispose();
    (this.targetRing.material as THREE.Material).dispose();
  }
}
