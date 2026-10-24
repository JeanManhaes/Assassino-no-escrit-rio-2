import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { 
  createCarpetTexture, 
  createWoodTexture, 
  createCeilingTexture, 
  createScreenTexture, 
  createPosterTexture, 
  createWhiteboardTexture,
  createWindowSkylineTexture,
  createAbstractArtTexture,
  createCorporateWallTexture,
  createIndustrialWallTexture,
  createBreakroomTileTexture
} from './proceduralTextures';
import { createCartoonMaterial } from './cartoonShaders';
import { PhysicsWorld, InteractiveProp, WeaponPropType } from './physicsWorld';
import { navSystem } from './pathfinding';

export interface OfficeRoomZone {
  name: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
  ambientColor: number;
}

export interface GeneratedOffice {
  officeGroup: THREE.Group;
  rooms: OfficeRoomZone[];
  spawnPoints: { room: string; pos: THREE.Vector3; nodeId: string }[];
  interactiveProps: InteractiveProp[];
  deskLocations: THREE.Vector3[];
  flickerLight: THREE.PointLight | null;
  generatorSwitchPos: THREE.Vector3;
  generatorMesh: THREE.Group;
  generatorLight: THREE.PointLight;
  officeLights: THREE.Light[];
  stairsBoundingBox: { min: THREE.Vector3; max: THREE.Vector3 };
}

export function generateProceduralOffice(
  scene: THREE.Scene,
  physicsWorld: PhysicsWorld,
  theme: 'modern_tech' | 'corporate_law' | 'fintech' = 'modern_tech'
): GeneratedOffice {
  // Clear previous navigation walls & nodes
  navSystem.clear();

  const officeGroup = new THREE.Group();
  scene.add(officeGroup);

  const rooms: OfficeRoomZone[] = [];
  const spawnPoints: { room: string; pos: THREE.Vector3; nodeId: string }[] = [];
  const deskLocations: THREE.Vector3[] = [];

  // Theme Textures
  const carpetTex = createCarpetTexture(theme === 'corporate_law' ? 'burgundy' : (theme === 'fintech' ? 'navy' : 'slate'));
  const woodTex = createWoodTexture(theme === 'corporate_law');
  const ceilingTex = createCeilingTexture();
  const corporateWallTex = createCorporateWallTexture(theme);
  const industrialWallTex = createIndustrialWallTexture();
  const breakroomTileTex = createBreakroomTileTexture();
  const codeScreenTex = createScreenTexture('code');
  const chartScreenTex = createScreenTexture('chart');
  const redditScreenTex = createScreenTexture('reddit');
  const warningScreenTex = createScreenTexture('warning');
  const whiteboardTex = createWhiteboardTexture();
  const windowSkylineTex = createWindowSkylineTexture();
  const art1Tex = createAbstractArtTexture(1);
  const art2Tex = createAbstractArtTexture(2);

  const posterSynergyTex = createPosterTexture('Sinergia', 'Trabalhar juntos para o lucro comum', '#1e3a8a');
  const posterHustleTex = createPosterTexture('Resiliência', 'Descanso é para os fracos', '#b45309');
  const posterFocusTex = createPosterTexture('Foco Total', 'A meta é dobrar a meta', '#047857');

  // Materials with high-fidelity procedural textures
  const wallMat = createCartoonMaterial({ color: 0xffffff, map: corporateWallTex });
  const darkWallMat = createCartoonMaterial({ color: 0xffffff, map: industrialWallTex });
  const breakroomWallMat = createCartoonMaterial({ color: 0xffffff, map: breakroomTileTex });
  const trimMat = createCartoonMaterial({ color: 0x475569 });
  const floorMat = createCartoonMaterial({ color: 0xffffff, map: carpetTex });
  const ceilingMat = createCartoonMaterial({ color: 0xffffff, map: ceilingTex });
  const deskWoodMat = createCartoonMaterial({ color: 0xffffff, map: woodTex });
  const metalMat = createCartoonMaterial({ color: 0x334155 });
  const chairLeatherMat = createCartoonMaterial({ color: theme === 'corporate_law' ? 0x451a03 : 0x0f172a });

  const officeWidth = 46;
  const officeDepth = 34;
  const wallHeight = 3.6;

  // 1. FLOOR & CEILING
  const floorGeo = new THREE.PlaneGeometry(officeWidth, officeDepth);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  officeGroup.add(floorMesh);

  // Floor 1 Ceiling with opening for the 2nd Floor staircase
  const ceilingGeoW = new THREE.PlaneGeometry(38, officeDepth);
  const ceilingMeshW = new THREE.Mesh(ceilingGeoW, ceilingMat);
  ceilingMeshW.position.set(-4, wallHeight, 0);
  ceilingMeshW.rotation.x = Math.PI / 2;
  officeGroup.add(ceilingMeshW);

  const ceilingGeoE = new THREE.PlaneGeometry(8, 12);
  const ceilingMeshE = new THREE.Mesh(ceilingGeoE, ceilingMat);
  ceilingMeshE.position.set(19, wallHeight, -11);
  ceilingMeshE.rotation.x = Math.PI / 2;
  officeGroup.add(ceilingMeshE);

  // Helper to build a solid wall with physics collider and navigation registration
  const buildWall = (
    start: THREE.Vector3,
    end: THREE.Vector3,
    thickness: number = 0.28,
    customMat = wallMat,
    baseY: number = 0,
    h: number = wallHeight
  ) => {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    center.y = baseY + h / 2;
    const angle = Math.atan2(dir.x, dir.z);

    const wallGeo = new THREE.BoxGeometry(thickness, h, length);
    const wallMesh = new THREE.Mesh(wallGeo, customMat);
    wallMesh.position.copy(center);
    wallMesh.rotation.y = angle;
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    officeGroup.add(wallMesh);

    // Wall physics collider
    physicsWorld.addStaticBox(
      center,
      new THREE.Vector3(
        Math.abs(Math.sin(angle)) * (length / 2) + Math.abs(Math.cos(angle)) * (thickness / 2),
        h / 2,
        Math.abs(Math.cos(angle)) * (length / 2) + Math.abs(Math.sin(angle)) * (thickness / 2)
      )
    );

    // Register wall line in Navigation System with vertical bounds
    navSystem.addWall(start.x, start.z, end.x, end.z, baseY - 0.2, baseY + h + 0.2);
  };

  const halfW = officeWidth / 2;
  const halfD = officeDepth / 2;

  // Outer Perimeter Walls
  buildWall(new THREE.Vector3(-halfW, 0, -halfD), new THREE.Vector3(halfW, 0, -halfD));
  buildWall(new THREE.Vector3(-halfW, 0, halfD), new THREE.Vector3(halfW, 0, halfD));
  buildWall(new THREE.Vector3(-halfW, 0, -halfD), new THREE.Vector3(-halfW, 0, halfD));
  buildWall(new THREE.Vector3(halfW, 0, -halfD), new THREE.Vector3(halfW, 0, halfD));

  // Randomized door opening positions based on seed
  const doorOffsetZ = (Math.random() < 0.5) ? -7.0 : -6.0;

  // CEO Suite walls (NW Room)
  buildWall(new THREE.Vector3(-11, 0, -17), new THREE.Vector3(-11, 0, doorOffsetZ - 1.2));
  buildWall(new THREE.Vector3(-11, 0, doorOffsetZ + 1.2), new THREE.Vector3(-11, 0, -5));
  buildWall(new THREE.Vector3(-23, 0, -5), new THREE.Vector3(-11, 0, -5));

  // Boardroom walls (NE Room)
  buildWall(new THREE.Vector3(7, 0, -17), new THREE.Vector3(7, 0, -7.5));
  buildWall(new THREE.Vector3(7, 0, -5.5), new THREE.Vector3(7, 0, -4.5));
  buildWall(new THREE.Vector3(7, 0, -5), new THREE.Vector3(23, 0, -5));

  // Server Room walls (E Mid Room)
  buildWall(new THREE.Vector3(11, 0, -5), new THREE.Vector3(11, 0, -1.2), 0.35, darkWallMat);
  buildWall(new THREE.Vector3(11, 0, 1.2), new THREE.Vector3(11, 0, 5), 0.35, darkWallMat);
  buildWall(new THREE.Vector3(11, 0, 5), new THREE.Vector3(23, 0, 5), 0.35, darkWallMat);

  // Breakroom walls (SW Room)
  buildWall(new THREE.Vector3(-23, 0, 5), new THREE.Vector3(-11, 0, 5));
  buildWall(new THREE.Vector3(-11, 0, 5), new THREE.Vector3(-11, 0, 9.8));
  buildWall(new THREE.Vector3(-11, 0, 12.2), new THREE.Vector3(-11, 0, 17));

  // DEFINE NAVIGATION NODES & DOORWAY WAYPOINTS FOR SAFE PATHFINDING
  navSystem.addNode('node-ceo-desk', -17, -11, 'Gabinete do CEO', ['node-ceo-door']);
  navSystem.addNode('node-ceo-door', -11, doorOffsetZ, 'Gabinete do CEO', ['node-ceo-desk', 'node-corridor-nw']);

  navSystem.addNode('node-corridor-nw', -8, -7, 'Corredor Noroeste', ['node-ceo-door', 'node-bullpen-center', 'node-corridor-n']);
  navSystem.addNode('node-corridor-n', 0, -12, 'Corredor Norte', ['node-corridor-nw', 'node-board-door']);
  navSystem.addNode('node-board-door', 7, -6.5, 'Sala de Reunião', ['node-corridor-n', 'node-board-table']);
  navSystem.addNode('node-board-table', 15, -11, 'Sala de Reunião', ['node-board-door']);

  navSystem.addNode('node-bullpen-center', 0, 0, 'Bullpen Central', ['node-corridor-nw', 'node-server-door', 'node-break-door', 'node-reception']);
  navSystem.addNode('node-server-door', 11, 0, 'Sala dos Servidores', ['node-bullpen-center', 'node-server-racks']);
  navSystem.addNode('node-server-racks', 17, 0, 'Sala dos Servidores', ['node-server-door']);

  navSystem.addNode('node-break-door', -11, 11, 'Copa e Cozinha', ['node-bullpen-center', 'node-break-counter']);
  navSystem.addNode('node-break-counter', -17, 11, 'Copa e Cozinha', ['node-break-door']);

  navSystem.addNode('node-reception', 0, 12, 'Recepção', ['node-bullpen-center', 'node-stairs-bottom']);

  // Staircase and Floor 2 Navigation Nodes
  navSystem.addNode('node-stairs-bottom', 19, 15.5, 'Escadaria de Acesso ao 2º Andar', ['node-reception', 'node-stairs-top'], 0);
  navSystem.addNode('node-stairs-top', 19, 7.0, 'Escadaria de Acesso ao 2º Andar', ['node-stairs-bottom', 'node-floor2-hall'], 4.0);
  navSystem.addNode('node-floor2-hall', 18.5, 5.0, '2º Andar - Hall Técnico', ['node-stairs-top', 'node-floor2-door'], 4.0);
  navSystem.addNode('node-floor2-door', 13.0, 3.0, '2º Andar - Hall Técnico', ['node-floor2-hall', 'node-gen-console'], 4.0);
  navSystem.addNode('node-gen-console', 8.5, -12.0, '2º Andar - Sala dos Geradores', ['node-floor2-door', 'node-gen-turbine1', 'node-gen-turbine2'], 4.0);
  navSystem.addNode('node-gen-turbine1', 2.0, -4.0, '2º Andar - Sala dos Geradores', ['node-gen-console'], 4.0);
  navSystem.addNode('node-gen-turbine2', 14.0, -4.0, '2º Andar - Sala dos Geradores', ['node-gen-console'], 4.0);

  // Bullpen desk nodes
  navSystem.addNode('node-desk-0', -5, -6, 'Bullpen Principal', ['node-bullpen-center']);
  navSystem.addNode('node-desk-1', 4, -6, 'Bullpen Principal', ['node-bullpen-center']);
  navSystem.addNode('node-desk-2', -5, 4, 'Bullpen Principal', ['node-bullpen-center']);
  navSystem.addNode('node-desk-3', 4, 4, 'Bullpen Principal', ['node-bullpen-center']);

  // Room Zones
  rooms.push(
    { name: 'Gabinete do CEO (Sua Sala)', min: new THREE.Vector3(-23, 0, -17), max: new THREE.Vector3(-11, wallHeight, -5), ambientColor: 0xffedd5 },
    { name: 'Bullpen Principal (Área de Trabalho)', min: new THREE.Vector3(-10, 0, -16), max: new THREE.Vector3(10, wallHeight, 16), ambientColor: 0xf8fafc },
    { name: 'Sala de Reunião da Diretoria', min: new THREE.Vector3(7, 0, -17), max: new THREE.Vector3(23, wallHeight, -5), ambientColor: 0xeff6ff },
    { name: 'Sala dos Servidores (TI)', min: new THREE.Vector3(11, 0, -5), max: new THREE.Vector3(23, wallHeight, 5), ambientColor: 0x1e3a8a },
    { name: 'Copa e Café dos Funcionários', min: new THREE.Vector3(-23, 0, 5), max: new THREE.Vector3(-11, wallHeight, 17), ambientColor: 0xfef3c7 },
    { name: 'Recepção e Entrada Principal', min: new THREE.Vector3(-8, 0, 8), max: new THREE.Vector3(15, wallHeight, 17), ambientColor: 0xf1f5f9 },
    { name: 'Escadaria de Acesso ao 2º Andar', min: new THREE.Vector3(15.5, 0, 6.5), max: new THREE.Vector3(22.5, 4.5, 16.5), ambientColor: 0xfde047 },
    { name: '2º Andar - Hall Técnico', min: new THREE.Vector3(11, 3.5, 2.5), max: new THREE.Vector3(23, 8.0, 16.5), ambientColor: 0xf1f5f9 },
    { name: '2º Andar - Sala dos Geradores', min: new THREE.Vector3(-6.5, 3.5, -17.5), max: new THREE.Vector3(23, 8.0, 3.5), ambientColor: 0xfef08a }
  );

  // SKYLINE WINDOW ON NORTH WALL (CEO & Boardroom View)
  const windowGeo = new THREE.PlaneGeometry(8, 2.4);
  const windowMat = createCartoonMaterial({ color: 0xffffff, map: windowSkylineTex, emissive: 0x0284c7, emissiveIntensity: 0.1 });
  const windowMesh1 = new THREE.Mesh(windowGeo, windowMat);
  windowMesh1.position.set(-17, 2.1, -16.85);
  officeGroup.add(windowMesh1);

  const windowMesh2 = new THREE.Mesh(windowGeo, windowMat);
  windowMesh2.position.set(15, 2.1, -16.85);
  officeGroup.add(windowMesh2);

  // DYNAMIC LIGHTS RIG: Global & Local Studio Lighting
  const officeLights: THREE.Light[] = [];

  // Studio Hemisphere Light for warm/cool contrast
  const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.65);
  officeGroup.add(hemiLight);
  officeLights.push(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  officeGroup.add(ambientLight);
  officeLights.push(ambientLight);

  const mainDirLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
  mainDirLight.position.set(12, 16, -14);
  mainDirLight.castShadow = true;
  mainDirLight.shadow.mapSize.width = 1024;
  mainDirLight.shadow.mapSize.height = 1024;
  mainDirLight.shadow.bias = -0.0005;
  mainDirLight.shadow.normalBias = 0.02;
  officeGroup.add(mainDirLight);
  officeLights.push(mainDirLight);

  const lampPositions = [
    [-17, -11], [-17, 11], [15, -11], [17, 0],
    [-4, -8], [4, -8], [-4, 2], [4, 2], [0, 12]
  ];

  let flickerLight: THREE.PointLight | null = null;
  lampPositions.forEach(([lx, lz], idx) => {
    const fixtureGeo = new THREE.BoxGeometry(2.4, 0.12, 0.6);
    const fixtureMat = createCartoonMaterial({
      color: 0xffffff,
      emissive: (lx === 17 && lz === 0) ? 0x38bdf8 : 0xfffedb,
      emissiveIntensity: 0.95
    });
    const fixtureMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixtureMesh.position.set(lx, wallHeight - 0.08, lz);
    officeGroup.add(fixtureMesh);

    const light = new THREE.PointLight((lx === 17 && lz === 0) ? 0x60a5fa : 0xfffaed, 1.15, 12, 1.2);
    light.position.set(lx, wallHeight - 0.3, lz);
    officeGroup.add(light);
    officeLights.push(light);

    if (idx === 3) flickerLight = light;
  });

  // ==========================================
  // STAIRCASE: CONNECTING FLOOR 1 TO FLOOR 2
  // ==========================================
  const numSteps = 12;
  const stepRise = 4.0 / numSteps;
  const stepTread = 8.0 / numSteps;
  const stairWidth = 3.6;
  const stairStartX = 19;
  const stairZStart = 15;

  const stairMat = createCartoonMaterial({ color: 0x334155 });
  const stairNosingMat = createCartoonMaterial({ color: 0xf59e0b, emissive: 0xd97706, emissiveIntensity: 0.3 });
  const handrailMat = createCartoonMaterial({ color: 0xd4d4d8 });

  for (let s = 0; s < numSteps; s++) {
    const curY = (s + 0.5) * stepRise;
    const curZ = stairZStart - (s + 0.5) * stepTread;

    const stepGeo = new THREE.BoxGeometry(stairWidth, stepRise, stepTread);
    const stepMesh = new THREE.Mesh(stepGeo, stairMat);
    stepMesh.position.set(stairStartX, curY, curZ);
    stepMesh.receiveShadow = true;
    officeGroup.add(stepMesh);

    const nosingGeo = new THREE.BoxGeometry(stairWidth, 0.03, 0.06);
    const nosingMesh = new THREE.Mesh(nosingGeo, stairNosingMat);
    nosingMesh.position.set(stairStartX, curY + stepRise / 2 + 0.015, curZ - stepTread / 2 + 0.03);
    officeGroup.add(nosingMesh);

    physicsWorld.addStaticBox(
      new THREE.Vector3(stairStartX, curY, curZ),
      new THREE.Vector3(stairWidth / 2, stepRise / 2, stepTread / 2)
    );
  }

  // Safety Handrails
  for (const railX of [stairStartX - stairWidth / 2 + 0.1, stairStartX + stairWidth / 2 - 0.1]) {
    const railLength = Math.sqrt(8.0 * 8.0 + 4.0 * 4.0);
    const railAngle = Math.atan2(4.0, 8.0);
    const railGeo = new THREE.CylinderGeometry(0.035, 0.035, railLength, 8);
    const railMesh = new THREE.Mesh(railGeo, handrailMat);
    railMesh.position.set(railX, 2.0 + 0.85, 11);
    railMesh.rotation.x = Math.PI / 2 + railAngle;
    officeGroup.add(railMesh);
  }

  // Directional Sign at entrance of stairs (Floor 1)
  const signGeo = new THREE.BoxGeometry(3.2, 0.6, 0.1);
  const signMat = createCartoonMaterial({ color: 0x0f172a, emissive: 0x0284c7, emissiveIntensity: 0.3 });
  const signMesh = new THREE.Mesh(signGeo, signMat);
  signMesh.position.set(stairStartX, 3.1, stairZStart + 0.2);
  officeGroup.add(signMesh);

  const signTextTex = createPosterTexture('2º ANDAR', 'SUBESTAÇÃO & GERADORES ELÉTRICOS ⬆', '#0284c7');
  const signTextMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.5), createCartoonMaterial({ color: 0xffffff, map: signTextTex }));
  signTextMesh.position.set(stairStartX, 3.1, stairZStart + 0.26);
  officeGroup.add(signTextMesh);

  // ==========================================
  // FLOOR 2: SUBESTAÇÃO & SALA DOS GERADORES
  // ==========================================
  const floor2Y = 4.0;
  const floor2Height = 3.6;
  const floor2CeilingY = floor2Y + floor2Height;

  const floor2Width = 29;
  const floor2Depth = 24;
  const floor2CenterX = 8.5;
  const floor2CenterZ = -5.0;

  const technicalFloorMat = createCartoonMaterial({ color: 0xd4d4d8 });
  const floor2Geo = new THREE.BoxGeometry(floor2Width, 0.25, floor2Depth);
  const floor2Mesh = new THREE.Mesh(floor2Geo, technicalFloorMat);
  floor2Mesh.position.set(floor2CenterX, floor2Y - 0.125, floor2CenterZ);
  floor2Mesh.receiveShadow = true;
  officeGroup.add(floor2Mesh);

  physicsWorld.addStaticBox(
    new THREE.Vector3(floor2CenterX, floor2Y - 0.125, floor2CenterZ),
    new THREE.Vector3(floor2Width / 2, 0.125, floor2Depth / 2)
  );

  const floor2CeilingGeo = new THREE.PlaneGeometry(floor2Width, floor2Depth);
  const floor2CeilingMesh = new THREE.Mesh(floor2CeilingGeo, ceilingMat);
  floor2CeilingMesh.position.set(floor2CenterX, floor2CeilingY, floor2CenterZ);
  floor2CeilingMesh.rotation.x = Math.PI / 2;
  officeGroup.add(floor2CeilingMesh);

  // Floor 2 Outer Walls
  buildWall(new THREE.Vector3(-6, 0, -17), new THREE.Vector3(23, 0, -17), 0.35, darkWallMat, floor2Y, floor2Height);
  buildWall(new THREE.Vector3(-6, 0, -17), new THREE.Vector3(-6, 0, 7), 0.35, darkWallMat, floor2Y, floor2Height);
  buildWall(new THREE.Vector3(23, 0, -17), new THREE.Vector3(23, 0, 7), 0.35, darkWallMat, floor2Y, floor2Height);
  buildWall(new THREE.Vector3(-6, 0, 7), new THREE.Vector3(17, 0, 7), 0.35, darkWallMat, floor2Y, floor2Height);
  buildWall(new THREE.Vector3(21, 0, 7), new THREE.Vector3(23, 0, 7), 0.35, darkWallMat, floor2Y, floor2Height);

  // Floor 2 Divider Wall
  buildWall(new THREE.Vector3(-6, 0, 3), new THREE.Vector3(11, 0, 3), 0.3, wallMat, floor2Y, floor2Height);
  buildWall(new THREE.Vector3(14, 0, 3), new THREE.Vector3(23, 0, 3), 0.3, wallMat, floor2Y, floor2Height);

  // ==========================================
  // INDUSTRIAL TURBO-GENERATORS (#1 & #2)
  // ==========================================
  const buildGeneratorTurbine = (x: number, z: number, idNum: number) => {
    const genGroup = new THREE.Group();
    genGroup.position.set(x, floor2Y, z);
    officeGroup.add(genGroup);

    const genHousingGeo = new THREE.BoxGeometry(3.6, 1.9, 1.8);
    const genHousingMat = createCartoonMaterial({ color: 0xca8a04 });
    const genHousing = new THREE.Mesh(genHousingGeo, genHousingMat);
    genHousing.position.y = 0.95;
    genGroup.add(genHousing);

    const stripeGeo = new THREE.BoxGeometry(3.65, 0.14, 1.85);
    const stripeMat = createCartoonMaterial({ color: 0x09090b });
    const stripe1 = new THREE.Mesh(stripeGeo, stripeMat);
    stripe1.position.y = 0.2;
    const stripe2 = new THREE.Mesh(stripeGeo, stripeMat);
    stripe2.position.y = 1.7;
    genGroup.add(stripe1);
    genGroup.add(stripe2);

    const grillGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.1, 16);
    const grillMat = createCartoonMaterial({ color: 0x1e293b });
    const grill = new THREE.Mesh(grillGeo, grillMat);
    grill.rotation.x = Math.PI / 2;
    grill.position.set(0, 1.0, 0.92);
    genGroup.add(grill);

    const exhaustGeo = new THREE.CylinderGeometry(0.18, 0.18, 1.8, 12);
    const exhaustMat = createCartoonMaterial({ color: 0x334155 });
    const exhaust = new THREE.Mesh(exhaustGeo, exhaustMat);
    exhaust.position.set(0.9, 2.3, 0);
    genGroup.add(exhaust);

    const statusGeo = new THREE.SphereGeometry(0.06, 8, 8);
    const statusMat = createCartoonMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.9 });
    const statusMesh = new THREE.Mesh(statusGeo, statusMat);
    statusMesh.position.set(-1.4, 1.4, 0.92);
    genGroup.add(statusMesh);

    const genExtents = new THREE.Vector3(1.8, 0.95, 0.9);
    physicsWorld.addStaticBox(new THREE.Vector3(x, floor2Y + 0.95, z), genExtents);
    navSystem.addObstacleBox(new THREE.Vector3(x, floor2Y + 0.95, z), genExtents, floor2Y, floor2CeilingY);
  };

  buildGeneratorTurbine(2.0, -6.0, 1);
  buildGeneratorTurbine(14.0, -6.0, 2);

  // ==========================================
  // MAIN ELECTRICAL BREAKER CONSOLE (PAINEL GERAL)
  // ==========================================
  const generatorSwitchPos = new THREE.Vector3(8.5, floor2Y, -15.5);
  const generatorMesh = new THREE.Group();
  generatorMesh.position.copy(generatorSwitchPos);
  officeGroup.add(generatorMesh);

  const cabGeo = new THREE.BoxGeometry(1.6, 2.0, 0.45);
  const cabMat = createCartoonMaterial({ color: 0x1e293b, emissive: 0x0f172a, emissiveIntensity: 0.2 });
  const cabMesh = new THREE.Mesh(cabGeo, cabMat);
  cabMesh.position.y = 1.0;
  generatorMesh.add(cabMesh);

  const hazSignGeo = new THREE.BoxGeometry(1.2, 0.45, 0.04);
  const hazSignMat = createCartoonMaterial({ color: 0xeab308 });
  const hazSign = new THREE.Mesh(hazSignGeo, hazSignMat);
  hazSign.position.set(0, 1.6, 0.24);
  generatorMesh.add(hazSign);

  const leverBaseGeo = new THREE.BoxGeometry(0.25, 0.4, 0.1);
  const leverBaseMat = createCartoonMaterial({ color: 0x09090b });
  const leverBase = new THREE.Mesh(leverBaseGeo, leverBaseMat);
  leverBase.position.set(0, 1.0, 0.25);
  generatorMesh.add(leverBase);

  const leverHandleGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.32, 8);
  const leverHandleMat = createCartoonMaterial({ color: 0xef4444, emissive: 0xb91c1c, emissiveIntensity: 0.5 });
  const leverHandle = new THREE.Mesh(leverHandleGeo, leverHandleMat);
  leverHandle.position.set(0, 1.05, 0.32);
  leverHandle.rotation.x = 0.5;
  generatorMesh.add(leverHandle);

  const generatorLight = new THREE.PointLight(0x22c55e, 1.6, 12, 1.2);
  generatorLight.position.set(8.5, floor2Y + 2.2, -15.0);
  officeGroup.add(generatorLight);
  officeLights.push(generatorLight);

  // Battery Bank Racks along west wall of Generator room
  for (let b = 0; b < 3; b++) {
    const battRackGeo = new THREE.BoxGeometry(0.65, 1.8, 1.6);
    const battRackMat = createCartoonMaterial({ color: 0x0f172a, emissive: 0x0284c7, emissiveIntensity: 0.15 });
    const battMesh = new THREE.Mesh(battRackGeo, battRackMat);
    battMesh.position.set(-5.3, floor2Y + 0.9, -12 + b * 2.8);
    officeGroup.add(battMesh);

    const battExtents = new THREE.Vector3(0.35, 0.9, 0.8);
    physicsWorld.addStaticBox(new THREE.Vector3(-5.3, floor2Y + 0.9, -12 + b * 2.8), battExtents);
    navSystem.addObstacleBox(new THREE.Vector3(-5.3, floor2Y + 0.9, -12 + b * 2.8), battExtents, floor2Y, floor2CeilingY);
  }

  // Workbench with diagnostic computers on Floor 2
  const workBenchGeo = new THREE.BoxGeometry(2.4, 0.8, 1.0);
  const workBenchMat = createCartoonMaterial({ color: 0x475569 });
  const bench1 = new THREE.Mesh(workBenchGeo, workBenchMat);
  bench1.position.set(8.5, floor2Y + 0.4, -4);
  officeGroup.add(bench1);
  const benchExtents = new THREE.Vector3(1.2, 0.4, 0.5);
  physicsWorld.addStaticBox(new THREE.Vector3(8.5, floor2Y + 0.4, -4), benchExtents);
  navSystem.addObstacleBox(new THREE.Vector3(8.5, floor2Y + 0.4, -4), benchExtents, floor2Y, floor2CeilingY);

  // Floor 2 Lamps
  const floor2Lamps = [
    [2, -6], [14, -6], [8.5, -14], [18, 5]
  ];
  floor2Lamps.forEach(([lx, lz]) => {
    const fixtureGeo = new THREE.BoxGeometry(2.0, 0.12, 0.5);
    const fixtureMat = createCartoonMaterial({ color: 0xffffff, emissive: 0xfef08a, emissiveIntensity: 0.85 });
    const fixMesh = new THREE.Mesh(fixtureGeo, fixtureMat);
    fixMesh.position.set(lx, floor2CeilingY - 0.08, lz);
    officeGroup.add(fixMesh);

    const fl2Light = new THREE.PointLight(0xfef9c3, 1.2, 12, 1.2);
    fl2Light.position.set(lx, floor2CeilingY - 0.3, lz);
    officeGroup.add(fl2Light);
    officeLights.push(fl2Light);
  });

  // FURNITURE & MODULAR DESKS
  const buildDeskCluster = (centerX: number, centerZ: number, rotation: number = 0) => {
    const clusterGroup = new THREE.Group();
    clusterGroup.position.set(centerX, 0, centerZ);
    clusterGroup.rotation.y = rotation;
    officeGroup.add(clusterGroup);

    const deskGeo = new THREE.BoxGeometry(2.3, 0.75, 1.1);
    const deskMesh1 = new THREE.Mesh(deskGeo, deskWoodMat);
    deskMesh1.position.set(0, 0.375, -0.6);
    clusterGroup.add(deskMesh1);

    const deskMesh2 = new THREE.Mesh(deskGeo, deskWoodMat);
    deskMesh2.position.set(0, 0.375, 0.6);
    clusterGroup.add(deskMesh2);

    const partGeo = new THREE.BoxGeometry(2.3, 0.45, 0.06);
    const partMat = createCartoonMaterial({ color: 0x0284c7 });
    const partMesh = new THREE.Mesh(partGeo, partMat);
    partMesh.position.set(0, 0.95, 0);
    clusterGroup.add(partMesh);

    const deskWorldPos1 = new THREE.Vector3(centerX, 0.375, centerZ - 0.6);
    const deskWorldPos2 = new THREE.Vector3(centerX, 0.375, centerZ + 0.6);
    const deskHalfExtents = new THREE.Vector3(1.15, 0.38, 0.55);
    physicsWorld.addStaticBox(deskWorldPos1, deskHalfExtents);
    physicsWorld.addStaticBox(deskWorldPos2, deskHalfExtents);

    // Register solid obstacle for AI & Player collision push-out
    navSystem.addObstacleBox(deskWorldPos1, deskHalfExtents);
    navSystem.addObstacleBox(deskWorldPos2, deskHalfExtents);

    deskLocations.push(deskWorldPos1);
    deskLocations.push(deskWorldPos2);

    const placeMonitor = (relX: number, relZ: number, screenMat: THREE.Material, rotY: number = 0) => {
      const monGroup = new THREE.Group();
      monGroup.position.set(relX, 0.75, relZ);
      monGroup.rotation.y = rotY;

      const standMesh = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.16), metalMat);
      const poleMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.22, 8), metalMat);
      poleMesh.position.y = 0.11;
      monGroup.add(standMesh);
      monGroup.add(poleMesh);

      const frameMesh = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.44, 0.04), metalMat);
      frameMesh.position.y = 0.32;
      monGroup.add(frameMesh);

      const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.4), screenMat);
      screenMesh.position.set(0, 0.32, 0.025);
      monGroup.add(screenMesh);

      clusterGroup.add(monGroup);
    };

    placeMonitor(-0.4, -0.7, createCartoonMaterial({ color: 0xffffff, map: codeScreenTex }), 0);
    placeMonitor(0.4, -0.7, createCartoonMaterial({ color: 0xffffff, map: chartScreenTex }), 0.1);
    placeMonitor(-0.3, 0.7, createCartoonMaterial({ color: 0xffffff, map: redditScreenTex }), Math.PI);
    placeMonitor(0.4, 0.7, createCartoonMaterial({ color: 0xffffff, map: codeScreenTex }), Math.PI - 0.1);
  };

  buildDeskCluster(-5, -6, 0);
  buildDeskCluster(4, -6, 0);
  buildDeskCluster(-5, 4, 0);
  buildDeskCluster(4, 4, 0);

  // CEO Suite Executive Desk
  const ceoDeskGeo = new THREE.BoxGeometry(3.2, 0.78, 1.4);
  const ceoDeskMesh = new THREE.Mesh(ceoDeskGeo, createCartoonMaterial({ color: 0x3e1f0e, map: woodTex }));
  ceoDeskMesh.position.set(-17, 0.39, -11);
  officeGroup.add(ceoDeskMesh);
  const ceoDeskExtents = new THREE.Vector3(1.6, 0.39, 0.7);
  physicsWorld.addStaticBox(new THREE.Vector3(-17, 0.39, -11), ceoDeskExtents);
  navSystem.addObstacleBox(new THREE.Vector3(-17, 0.39, -11), ceoDeskExtents);

  // CEO Safe
  const safeMesh = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), createCartoonMaterial({ color: 0x0f172a, emissive: 0xf59e0b, emissiveIntensity: 0.18 }));
  safeMesh.position.set(-21.5, 0.6, -15.5);
  officeGroup.add(safeMesh);
  const safeExtents = new THREE.Vector3(0.45, 0.6, 0.45);
  physicsWorld.addStaticBox(new THREE.Vector3(-21.5, 0.6, -15.5), safeExtents);
  navSystem.addObstacleBox(new THREE.Vector3(-21.5, 0.6, -15.5), safeExtents);

  // Boardroom Conference Table
  const boardTableMesh = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.76, 2.2), deskWoodMat);
  boardTableMesh.position.set(15, 0.38, -11);
  officeGroup.add(boardTableMesh);
  const boardTableExtents = new THREE.Vector3(3.2, 0.38, 1.1);
  physicsWorld.addStaticBox(new THREE.Vector3(15, 0.38, -11), boardTableExtents);
  navSystem.addObstacleBox(new THREE.Vector3(15, 0.38, -11), boardTableExtents);

  // Server Room Racks
  for (let rz = -3; rz <= 3; rz += 2.2) {
    const rackMesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 0.8), createCartoonMaterial({ color: 0x09090b, emissive: 0x0284c7, emissiveIntensity: 0.35 }));
    rackMesh.position.set(18.5, 1.4, rz);
    officeGroup.add(rackMesh);
    const rackExtents = new THREE.Vector3(0.6, 1.4, 0.4);
    physicsWorld.addStaticBox(new THREE.Vector3(18.5, 1.4, rz), rackExtents);
    navSystem.addObstacleBox(new THREE.Vector3(18.5, 1.4, rz), rackExtents);
  }

  // Breakroom Kitchen Counter & Water Cooler
  const breakCounter = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.85, 1.2), createCartoonMaterial({ color: 0x334155 }));
  breakCounter.position.set(-17, 0.425, 14.5);
  officeGroup.add(breakCounter);
  const counterExtents = new THREE.Vector3(1.8, 0.43, 0.6);
  physicsWorld.addStaticBox(new THREE.Vector3(-17, 0.425, 14.5), counterExtents);
  navSystem.addObstacleBox(new THREE.Vector3(-17, 0.425, 14.5), counterExtents);

  // Water Cooler
  const coolerBase = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), createCartoonMaterial({ color: 0xf8fafc }));
  coolerBase.position.set(-13, 0.45, 15);
  const bottleGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.45, 12);
  const bottleMat = createCartoonMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.3 });
  const bottle = new THREE.Mesh(bottleGeo, bottleMat);
  bottle.position.set(-13, 1.05, 15);
  officeGroup.add(coolerBase);
  officeGroup.add(bottle);
  const coolerExtents = new THREE.Vector3(0.3, 0.6, 0.3);
  physicsWorld.addStaticBox(new THREE.Vector3(-13, 0.6, 15), coolerExtents);
  navSystem.addObstacleBox(new THREE.Vector3(-13, 0.6, 15), coolerExtents);

  // Artwork & Posters
  const makeArt = (pos: THREE.Vector3, rotY: number, tex: THREE.Texture, w = 1.6, h = 1.6) => {
    const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), createCartoonMaterial({ color: 0xffffff, map: tex }));
    pMesh.position.copy(pos);
    pMesh.rotation.y = rotY;
    officeGroup.add(pMesh);
  };

  makeArt(new THREE.Vector3(-12.5, 2.2, -5.15), 0, art1Tex, 1.8, 1.4);
  makeArt(new THREE.Vector3(19.5, 2.2, -5.15), 0, art2Tex, 1.8, 1.4);
  makeArt(new THREE.Vector3(-3, 2.1, -16.85), 0, posterSynergyTex, 1.6, 1.2);
  makeArt(new THREE.Vector3(3, 2.1, -16.85), 0, posterHustleTex, 1.6, 1.2);

  // Potted Ficus Plants
  const makePlant = (pos: THREE.Vector3) => {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.22, 0.6, 8), createCartoonMaterial({ color: 0x78350f }));
    pot.position.set(pos.x, 0.3, pos.z);
    officeGroup.add(pot);

    const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(0.55, 1), createCartoonMaterial({ color: 0x15803d }));
    plant.position.set(pos.x, 0.95, pos.z);
    officeGroup.add(plant);
    const plantExtents = new THREE.Vector3(0.35, 0.5, 0.35);
    physicsWorld.addStaticBox(new THREE.Vector3(pos.x, 0.5, pos.z), plantExtents);
    navSystem.addObstacleBox(new THREE.Vector3(pos.x, 0.5, pos.z), plantExtents);
  };

  makePlant(new THREE.Vector3(-11.6, 0, -4.2));
  makePlant(new THREE.Vector3(6.2, 0, -4.2));
  makePlant(new THREE.Vector3(-11.6, 0, 4.2));
  makePlant(new THREE.Vector3(10.2, 0, 4.2));

  // SPAWN POINTS FOR CHARACTERS WITH WAYPOINT NODE REFERENCES (36 Spacious & Distinct Locations)
  spawnPoints.push(
    // Floor 1: Gabinete do CEO
    { room: 'Gabinete do CEO', pos: new THREE.Vector3(-14.5, 0, -8.5), nodeId: 'node-ceo-desk' },
    { room: 'Gabinete do CEO', pos: new THREE.Vector3(-19.5, 0, -8.5), nodeId: 'node-ceo-desk' },
    { room: 'Gabinete do CEO', pos: new THREE.Vector3(-14.5, 0, -14.0), nodeId: 'node-ceo-desk' },
    { room: 'Gabinete do CEO', pos: new THREE.Vector3(-19.5, 0, -14.0), nodeId: 'node-ceo-desk' },

    // Floor 1: Sala de Reunião da Diretoria
    { room: 'Sala de Reunião', pos: new THREE.Vector3(12.5, 0, -8.5), nodeId: 'node-board-table' },
    { room: 'Sala de Reunião', pos: new THREE.Vector3(17.5, 0, -8.5), nodeId: 'node-board-table' },
    { room: 'Sala de Reunião', pos: new THREE.Vector3(12.5, 0, -13.5), nodeId: 'node-board-table' },
    { room: 'Sala de Reunião', pos: new THREE.Vector3(17.5, 0, -13.5), nodeId: 'node-board-table' },
    { room: 'Sala de Reunião', pos: new THREE.Vector3(15.0, 0, -6.5), nodeId: 'node-board-table' },

    // Floor 1: Bullpen Principal (Workstation pods)
    { room: 'Bullpen Principal', pos: new THREE.Vector3(-4.0, 0, -3.8), nodeId: 'node-desk-0' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(-6.5, 0, -3.8), nodeId: 'node-desk-0' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(-4.0, 0, -8.5), nodeId: 'node-desk-0' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(-6.5, 0, -8.5), nodeId: 'node-desk-0' },

    { room: 'Bullpen Principal', pos: new THREE.Vector3(3.5, 0, -3.8), nodeId: 'node-desk-1' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(5.8, 0, -3.8), nodeId: 'node-desk-1' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(3.5, 0, -8.5), nodeId: 'node-desk-1' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(5.8, 0, -8.5), nodeId: 'node-desk-1' },

    { room: 'Bullpen Principal', pos: new THREE.Vector3(-4.0, 0, 1.8), nodeId: 'node-desk-2' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(-6.5, 0, 1.8), nodeId: 'node-desk-2' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(-4.0, 0, 6.2), nodeId: 'node-desk-2' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(-6.5, 0, 6.2), nodeId: 'node-desk-2' },

    { room: 'Bullpen Principal', pos: new THREE.Vector3(3.5, 0, 1.8), nodeId: 'node-desk-3' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(5.8, 0, 1.8), nodeId: 'node-desk-3' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(3.5, 0, 6.2), nodeId: 'node-desk-3' },
    { room: 'Bullpen Principal', pos: new THREE.Vector3(5.8, 0, 6.2), nodeId: 'node-desk-3' },

    // Floor 1: Sala dos Servidores (TI)
    { room: 'Sala dos Servidores', pos: new THREE.Vector3(15.0, 0, -2.0), nodeId: 'node-server-racks' },
    { room: 'Sala dos Servidores', pos: new THREE.Vector3(15.0, 0, 2.0), nodeId: 'node-server-racks' },
    { room: 'Sala dos Servidores', pos: new THREE.Vector3(19.5, 0, 0.0), nodeId: 'node-server-racks' },

    // Floor 1: Copa / Cozinha
    { room: 'Copa / Cozinha', pos: new THREE.Vector3(-15.0, 0, 9.0), nodeId: 'node-break-counter' },
    { room: 'Copa / Cozinha', pos: new THREE.Vector3(-18.5, 0, 9.0), nodeId: 'node-break-counter' },
    { room: 'Copa / Cozinha', pos: new THREE.Vector3(-15.0, 0, 14.0), nodeId: 'node-break-counter' },
    { room: 'Copa / Cozinha', pos: new THREE.Vector3(-18.5, 0, 14.0), nodeId: 'node-break-counter' },

    // Floor 1: Recepção e Corredores Centrais
    { room: 'Recepção', pos: new THREE.Vector3(-3.0, 0, 12.0), nodeId: 'node-reception' },
    { room: 'Recepção', pos: new THREE.Vector3(3.0, 0, 12.0), nodeId: 'node-reception' },
    { room: 'Recepção', pos: new THREE.Vector3(0.0, 0, 14.0), nodeId: 'node-reception' },
    { room: 'Corredor Central', pos: new THREE.Vector3(0.0, 0, -2.0), nodeId: 'node-bullpen-center' },
    { room: 'Corredor Central', pos: new THREE.Vector3(0.0, 0, 4.0), nodeId: 'node-bullpen-center' },

    // Floor 2: Subestação & Sala dos Geradores
    { room: '2º Andar - Sala dos Geradores', pos: new THREE.Vector3(8.5, floor2Y, -11.0), nodeId: 'node-gen-console' },
    { room: '2º Andar - Sala dos Geradores', pos: new THREE.Vector3(1.5, floor2Y, -4.0), nodeId: 'node-gen-turbine1' },
    { room: '2º Andar - Sala dos Geradores', pos: new THREE.Vector3(1.5, floor2Y, -9.0), nodeId: 'node-gen-turbine1' },
    { room: '2º Andar - Sala dos Geradores', pos: new THREE.Vector3(15.5, floor2Y, -4.0), nodeId: 'node-gen-turbine2' },
    { room: '2º Andar - Sala dos Geradores', pos: new THREE.Vector3(15.5, floor2Y, -9.0), nodeId: 'node-gen-turbine2' },
    { room: '2º Andar - Sala dos Geradores', pos: new THREE.Vector3(8.5, floor2Y, -2.5), nodeId: 'node-gen-console' },

    // Floor 2: Hall Técnico e Passarela
    { room: '2º Andar - Hall Técnico', pos: new THREE.Vector3(18.5, floor2Y, 3.0), nodeId: 'node-floor2-hall' },
    { room: '2º Andar - Hall Técnico', pos: new THREE.Vector3(14.0, floor2Y, 5.0), nodeId: 'node-floor2-hall' },
    { room: '2º Andar - Hall Técnico', pos: new THREE.Vector3(6.0, floor2Y, 5.0), nodeId: 'node-floor2-hall' }
  );

  // BUILD EXPANDED ARSENAL OF INTERACTIVE WEAPONS

  // 1. Caneta Tática
  const createPen = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const bodyM = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8), createCartoonMaterial({ color: 0x1e3a8a }));
    const tipM = new THREE.Mesh(new THREE.ConeGeometry(0.015, 0.03, 8), createCartoonMaterial({ color: 0xd4d4d8 }));
    tipM.position.y = 0.095;
    group.add(bodyM); group.add(tipM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 0.3, shape: new CANNON.Box(new CANNON.Vec3(0.03, 0.1, 0.03)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `pen-${Math.random().toString(36).slice(2, 6)}`, name: 'Caneta Tática de Metal', type: 'pen', mesh: group, body, isHeld: false, damage: 45, weightCategory: 'light' });
  };

  // 2. Grampeador Pesado
  const createStapler = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const baseM = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.04, 0.08), createCartoonMaterial({ color: 0xe2e8f0 }));
    const armM = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.07), createCartoonMaterial({ color: 0xdc2626 }));
    armM.position.set(-0.01, 0.04, 0);
    group.add(baseM); group.add(armM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 1.2, shape: new CANNON.Box(new CANNON.Vec3(0.09, 0.04, 0.04)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `stapler-${Math.random().toString(36).slice(2, 6)}`, name: 'Grampeador de Metal Vermelho', type: 'stapler', mesh: group, body, isHeld: false, damage: 75, weightCategory: 'medium' });
  };

  // 3. Tesoura de Escritório
  const createScissors = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.16, 0.005), createCartoonMaterial({ color: 0xe2e8f0 }));
    const handle1 = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.01, 6, 12), createCartoonMaterial({ color: 0x2563eb }));
    handle1.position.y = -0.09;
    group.add(blade1); group.add(handle1);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 0.5, shape: new CANNON.Box(new CANNON.Vec3(0.04, 0.1, 0.02)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `scissors-${Math.random().toString(36).slice(2, 6)}`, name: 'Tesoura de Aço Inox', type: 'scissors', mesh: group, body, isHeld: false, damage: 65, weightCategory: 'light' });
  };

  // 4. Garrafa Térmica Inox
  const createThermos = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const bottleM = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.22, 10), createCartoonMaterial({ color: 0x94a3b8 }));
    const capM = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), createCartoonMaterial({ color: 0x0f172a }));
    capM.position.y = 0.13;
    group.add(bottleM); group.add(capM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 1.5, shape: new CANNON.Box(new CANNON.Vec3(0.05, 0.12, 0.05)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `thermos-${Math.random().toString(36).slice(2, 6)}`, name: 'Garrafa Térmica Inox', type: 'thermos', mesh: group, body, isHeld: false, damage: 80, weightCategory: 'medium' });
  };

  // 5. Monitor LCD
  const createMonitorWeapon = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const frameM = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.38, 0.05), createCartoonMaterial({ color: 0x1e293b }));
    const screenM = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.34), createCartoonMaterial({ color: 0x38bdf8, emissive: 0x0284c7, emissiveIntensity: 0.2 }));
    screenM.position.z = 0.03;
    group.add(frameM); group.add(screenM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 3.5, shape: new CANNON.Box(new CANNON.Vec3(0.3, 0.2, 0.05)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `monitor-${Math.random().toString(36).slice(2, 6)}`, name: 'Monitor LCD 24 Polegadas', type: 'monitor', mesh: group, body, isHeld: false, damage: 95, weightCategory: 'heavy' });
  };

  // 6. Prancheta Executiva
  const createClipboard = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const boardM = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.32, 0.015), createCartoonMaterial({ color: 0x92400e }));
    const clipM = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.02), createCartoonMaterial({ color: 0xd4d4d8 }));
    clipM.position.y = 0.14;
    group.add(boardM); group.add(clipM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 0.6, shape: new CANNON.Box(new CANNON.Vec3(0.12, 0.16, 0.02)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `clip-${Math.random().toString(36).slice(2, 6)}`, name: 'Prancheta Executiva de Madeira', type: 'clipboard', mesh: group, body, isHeld: false, damage: 55, weightCategory: 'light' });
  };

  // 7. Lixeira de Metal
  const createWastebasket = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const binM = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.38, 12, 1, true), createCartoonMaterial({ color: 0x64748b, side: THREE.DoubleSide }));
    binM.position.y = 0.19;
    group.add(binM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 2.2, shape: new CANNON.Box(new CANNON.Vec3(0.16, 0.2, 0.16)), position: new CANNON.Vec3(pos.x, pos.y + 0.2, pos.z) });
    physicsWorld.registerProp({ id: `bin-${Math.random().toString(36).slice(2, 6)}`, name: 'Lixeira de Metal Aramada', type: 'wastebasket', mesh: group, body, isHeld: false, damage: 70, weightCategory: 'medium' });
  };

  // 8. Furador de Papel
  const createHolePunch = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const baseM = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.04, 0.12), createCartoonMaterial({ color: 0x1e293b }));
    const leverM = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.1), createCartoonMaterial({ color: 0x0284c7 }));
    leverM.position.set(0, 0.05, -0.01);
    group.add(baseM); group.add(leverM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 1.1, shape: new CANNON.Box(new CANNON.Vec3(0.07, 0.05, 0.06)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `punch-${Math.random().toString(36).slice(2, 6)}`, name: 'Furador de Papel Industrial', type: 'holepunch', mesh: group, body, isHeld: false, damage: 70, weightCategory: 'medium' });
  };

  // 9. Manual de Compliance Pesado (Book)
  const createBook = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const bookM = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.07, 0.28), createCartoonMaterial({ color: 0x7f1d1d }));
    group.add(bookM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 1.6, shape: new CANNON.Box(new CANNON.Vec3(0.1, 0.04, 0.14)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `book-${Math.random().toString(36).slice(2, 6)}`, name: 'Manual de Compliance (1.000 Páginas)', type: 'book', mesh: group, body, isHeld: false, damage: 65, weightCategory: 'medium' });
  };

  // 10. Guarda-chuva Executivo
  const createUmbrella = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const shaftM = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.75, 8), createCartoonMaterial({ color: 0x09090b }));
    const tipM = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.06, 8), createCartoonMaterial({ color: 0xd4d4d8 }));
    tipM.position.y = 0.38;
    group.add(shaftM); group.add(tipM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 1.0, shape: new CANNON.Box(new CANNON.Vec3(0.03, 0.38, 0.03)), position: new CANNON.Vec3(pos.x, pos.y + 0.38, pos.z) });
    physicsWorld.registerProp({ id: `umbrella-${Math.random().toString(36).slice(2, 6)}`, name: 'Guarda-chuva Executivo com Ponta', type: 'umbrella', mesh: group, body, isHeld: false, damage: 60, weightCategory: 'light' });
  };

  // Existing core weapons:
  const createMug = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const cupM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.055, 0.12, 12), createCartoonMaterial({ color: 0xf8fafc }));
    const handleM = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 6, 12, Math.PI), createCartoonMaterial({ color: 0xf8fafc }));
    handleM.position.set(0.06, 0, 0); handleM.rotation.z = -Math.PI / 2;
    group.add(cupM); group.add(handleM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 0.8, shape: new CANNON.Box(new CANNON.Vec3(0.06, 0.06, 0.06)), position: new CANNON.Vec3(pos.x, pos.y, pos.z) });
    physicsWorld.registerProp({ id: `mug-${Math.random().toString(36).slice(2, 6)}`, name: 'Caneca "Melhor Chefe do Mundo"', type: 'mug', mesh: group, body, isHeld: false, damage: 60, weightCategory: 'light' });
  };

  const createChair = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const poleM = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.45, 8), metalMat);
    poleM.position.y = 0.22; group.add(poleM);
    const starM = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 6), metalMat);
    starM.position.y = 0.05; group.add(starM);
    const seatM = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 0.52), chairLeatherMat);
    seatM.position.y = 0.48; group.add(seatM);
    const backM = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.55, 0.08), chairLeatherMat);
    backM.position.set(0, 0.8, -0.22); group.add(backM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 6.5, shape: new CANNON.Box(new CANNON.Vec3(0.28, 0.45, 0.28)), position: new CANNON.Vec3(pos.x, pos.y + 0.45, pos.z), linearDamping: 0.3, angularDamping: 0.4 });
    physicsWorld.registerProp({ id: `chair-${Math.random().toString(36).slice(2, 6)}`, name: 'Cadeira Giratória Ergonômica', type: 'chair', mesh: group, body, isHeld: false, damage: 100, weightCategory: 'heavy' });
  };

  const createExtinguisher = (pos: THREE.Vector3) => {
    const group = new THREE.Group();
    const tankM = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.55, 12), createCartoonMaterial({ color: 0xef4444 }));
    tankM.position.y = 0.28;
    const valveM = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.16), metalMat);
    valveM.position.set(0, 0.6, 0);
    group.add(tankM); group.add(valveM);
    group.position.copy(pos); officeGroup.add(group);

    const body = new CANNON.Body({ mass: 5.0, shape: new CANNON.Box(new CANNON.Vec3(0.14, 0.32, 0.14)), position: new CANNON.Vec3(pos.x, pos.y + 0.32, pos.z) });
    physicsWorld.registerProp({ id: `extinguisher-${Math.random().toString(36).slice(2, 6)}`, name: 'Extintor de Incêndio CO2', type: 'extinguisher', mesh: group, body, isHeld: false, damage: 100, weightCategory: 'heavy' });
  };

  // Populate Props Across Rooms
  createPen(new THREE.Vector3(-16.2, 0.8, -10.7));
  createStapler(new THREE.Vector3(-17.6, 0.82, -10.6));
  createMug(new THREE.Vector3(-16.8, 0.82, -10.4));
  createThermos(new THREE.Vector3(-16.0, 0.82, -11.2));
  createScissors(new THREE.Vector3(-17.2, 0.8, -11.5));
  createChair(new THREE.Vector3(-17, 0, -12.3));
  createWastebasket(new THREE.Vector3(-18.8, 0, -10.2));
  createBook(new THREE.Vector3(-17.8, 0.82, -11.4));

  // In Bullpen:
  createStapler(new THREE.Vector3(-4.6, 0.82, -5.5));
  createHolePunch(new THREE.Vector3(-5.2, 0.82, -5.4));
  createThermos(new THREE.Vector3(-4.2, 0.82, -6.6));
  createClipboard(new THREE.Vector3(-4.8, 0.8, -6.8));
  createWastebasket(new THREE.Vector3(-3.4, 0, -6.0));
  createChair(new THREE.Vector3(-5, 0, -4.6));

  createStapler(new THREE.Vector3(4.4, 0.82, -5.5));
  createScissors(new THREE.Vector3(3.6, 0.8, -5.4));
  createMonitorWeapon(new THREE.Vector3(5.2, 0.82, -5.5));
  createChair(new THREE.Vector3(4, 0, -4.6));

  createChair(new THREE.Vector3(-5, 0, 2.7));
  createChair(new THREE.Vector3(4, 0, 2.7));
  createMug(new THREE.Vector3(-4.5, 0.82, 4.4));
  createBook(new THREE.Vector3(3.5, 0.82, 4.4));

  // In Boardroom:
  createChair(new THREE.Vector3(13, 0, -9.6));
  createChair(new THREE.Vector3(15, 0, -9.6));
  createChair(new THREE.Vector3(17, 0, -9.6));
  createClipboard(new THREE.Vector3(14.5, 0.8, -11));
  createThermos(new THREE.Vector3(16.5, 0.82, -11));
  createBook(new THREE.Vector3(13.5, 0.82, -11));

  // In Hallways & Corridors:
  createExtinguisher(new THREE.Vector3(-10.5, 0, 0));
  createExtinguisher(new THREE.Vector3(10.5, 0, 7.5));
  createExtinguisher(new THREE.Vector3(-22.4, 0, -4));
  createUmbrella(new THREE.Vector3(-1.5, 0, 11));

  // In Breakroom:
  createMug(new THREE.Vector3(-21.5, 0.95, 10.5));
  createMug(new THREE.Vector3(-21.5, 0.95, 12));
  createWastebasket(new THREE.Vector3(-19.5, 0, 13));

  // In 2nd Floor Technical Substation & Generator Room:
  createExtinguisher(new THREE.Vector3(8.5, floor2Y, -16.5));
  createExtinguisher(new THREE.Vector3(21.5, floor2Y, 4.5));
  createThermos(new THREE.Vector3(8.0, floor2Y + 0.82, -4.0));
  createClipboard(new THREE.Vector3(9.0, floor2Y + 0.8, -4.0));
  createHolePunch(new THREE.Vector3(8.5, floor2Y + 0.82, -4.2));
  createWastebasket(new THREE.Vector3(10.2, floor2Y, -4.0));
  createMug(new THREE.Vector3(7.5, floor2Y + 0.82, -4.0));

  return {
    officeGroup,
    rooms,
    spawnPoints,
    interactiveProps: physicsWorld.props,
    deskLocations,
    flickerLight,
    generatorSwitchPos,
    generatorMesh,
    generatorLight,
    officeLights,
    stairsBoundingBox: {
      min: new THREE.Vector3(16.5, 0, 6.5),
      max: new THREE.Vector3(21.5, 4.2, 15.5)
    }
  };
}
