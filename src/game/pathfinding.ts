import * as THREE from 'three';

/**
 * Waypoint-based Navigation System & Solid Wall Collision Resolver
 * Ensures NPCs navigate fluidly through doorways and NEVER clip or pass through walls.
 */

export interface WallSegment {
  start: THREE.Vector2;
  end: THREE.Vector2;
  normal: THREE.Vector2;
  minY: number;
  maxY: number;
}

export interface ObstacleBox {
  min: THREE.Vector2;
  max: THREE.Vector2;
  minY: number;
  maxY: number;
}

export interface NavNode {
  id: string;
  pos: THREE.Vector3;
  roomName: string;
  neighbors: string[];
}

export class NavigationSystem {
  public walls: WallSegment[] = [];
  public obstacles: ObstacleBox[] = [];
  public nodes: Map<string, NavNode> = new Map();

  public addWall(x1: number, z1: number, x2: number, z2: number, minY: number = -1, maxY: number = 3.9) {
    const start = new THREE.Vector2(x1, z1);
    const end = new THREE.Vector2(x2, z2);
    const edge = new THREE.Vector2().subVectors(end, start).normalize();
    const normal = new THREE.Vector2(-edge.y, edge.x);
    this.walls.push({ start, end, normal, minY, maxY });
  }

  public addObstacleBox(center: THREE.Vector3, halfExtents: THREE.Vector3, minY: number = -1, maxY: number = 3.9) {
    this.obstacles.push({
      min: new THREE.Vector2(center.x - halfExtents.x, center.z - halfExtents.z),
      max: new THREE.Vector2(center.x + halfExtents.x, center.z + halfExtents.z),
      minY,
      maxY,
    });
  }

  public addNode(id: string, x: number, z: number, roomName: string, neighbors: string[], y: number = 0) {
    this.nodes.set(id, {
      id,
      pos: new THREE.Vector3(x, y, z),
      roomName,
      neighbors,
    });
  }

  /**
   * Breadth-First-Search pathfinding from current position to target node
   */
  public findPath(startPos: THREE.Vector3, targetNodeId: string): THREE.Vector3[] {
    // Find closest node to startPos
    let closestStartId = '';
    let minDist = Infinity;
    for (const [id, node] of this.nodes) {
      const d = startPos.distanceTo(node.pos);
      if (d < minDist) {
        minDist = d;
        closestStartId = id;
      }
    }

    if (!closestStartId || !this.nodes.has(targetNodeId)) {
      return [this.nodes.get(targetNodeId)?.pos.clone() || startPos.clone()];
    }

    const queue: string[] = [closestStartId];
    const visited = new Set<string>([closestStartId]);
    const parent = new Map<string, string>();

    let found = false;
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetNodeId) {
        found = true;
        break;
      }

      const node = this.nodes.get(current);
      if (!node) continue;

      for (const neighborId of node.neighbors) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          parent.set(neighborId, current);
          queue.push(neighborId);
        }
      }
    }

    if (!found) {
      return [this.nodes.get(targetNodeId)!.pos.clone()];
    }

    // Reconstruct path
    const path: THREE.Vector3[] = [];
    let curr: string | undefined = targetNodeId;
    while (curr) {
      const n = this.nodes.get(curr);
      if (n) path.unshift(n.pos.clone());
      curr = parent.get(curr);
    }
    return path;
  }

  /**
   * Resolves collision against all office walls for an entity.
   * Physically pushes the entity position out so it can NEVER cross a wall segment.
   */
  public resolveWallCollisions(pos: THREE.Vector3, radius: number = 0.45): boolean {
    let collided = false;
    const p = new THREE.Vector2(pos.x, pos.z);

    for (const wall of this.walls) {
      if (pos.y < wall.minY || pos.y > wall.maxY) continue;

      const line = new THREE.Vector2().subVectors(wall.end, wall.start);
      const lenSq = line.lengthSq();
      if (lenSq === 0) continue;

      // Project point onto line segment clamped [0, 1]
      const t = Math.max(0, Math.min(1, new THREE.Vector2().subVectors(p, wall.start).dot(line) / lenSq));
      const closest = new THREE.Vector2().copy(wall.start).addScaledVector(line, t);
      const diff = new THREE.Vector2().subVectors(p, closest);
      const dist = diff.length();

      if (dist < radius) {
        collided = true;
        if (dist > 0.0001) {
          diff.normalize();
          p.copy(closest).addScaledVector(diff, radius + 0.02);
        } else {
          p.addScaledVector(wall.normal, radius + 0.02);
        }
        pos.x = p.x;
        pos.z = p.y;
      }
    }

    return collided;
  }

  /**
   * Resolves collision against furniture obstacle boxes (desks, tables, racks, etc.)
   * Pushes the entity out so it never walks through or clips into furniture.
   */
  public resolveObstacleCollisions(pos: THREE.Vector3, radius: number = 0.45): boolean {
    let collided = false;

    for (const obs of this.obstacles) {
      if (pos.y < obs.minY || pos.y > obs.maxY) continue;
      // Find closest point on AABB to entity position (pos.x, pos.z)
      const cx = Math.max(obs.min.x, Math.min(obs.max.x, pos.x));
      const cz = Math.max(obs.min.y, Math.min(obs.max.y, pos.z));

      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const distSq = dx * dx + dz * dz;

      // If point is strictly inside AABB
      if (pos.x >= obs.min.x && pos.x <= obs.max.x && pos.z >= obs.min.y && pos.z <= obs.max.y) {
        collided = true;
        // Push along shallowest penetration axis
        const distLeft = pos.x - obs.min.x;
        const distRight = obs.max.x - pos.x;
        const distTop = pos.z - obs.min.y;
        const distBottom = obs.max.y - pos.z;

        const minPen = Math.min(distLeft, distRight, distTop, distBottom);
        if (minPen === distLeft) {
          pos.x = obs.min.x - radius - 0.02;
        } else if (minPen === distRight) {
          pos.x = obs.max.x + radius + 0.02;
        } else if (minPen === distTop) {
          pos.z = obs.min.y - radius - 0.02;
        } else {
          pos.z = obs.max.y + radius + 0.02;
        }
      } else if (distSq < radius * radius && distSq > 0.00001) {
        collided = true;
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        pos.x = cx + nx * (radius + 0.02);
        pos.z = cz + nz * (radius + 0.02);
      }
    }

    return collided;
  }

  /**
   * Multi-pass combined collision resolution against both walls and furniture obstacles
   */
  public resolveAllCollisions(pos: THREE.Vector3, radius: number = 0.45): boolean {
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      const hitWall = this.resolveWallCollisions(pos, radius);
      const hitObs = this.resolveObstacleCollisions(pos, radius);
      if (hitWall || hitObs) hit = true;
    }
    return hit;
  }

  public clear() {
    this.walls = [];
    this.obstacles = [];
    this.nodes.clear();
  }
}

export const navSystem = new NavigationSystem();
