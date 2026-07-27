import { Scene } from "@babylonjs/core/scene";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin";

// ── House constants ───────────────────────────────────────────────────
const T  = 0.3;  // wall thickness
const FT = 0.2;  // floor slab thickness
const FH = 3.5;  // ceiling height per story
const W  = 10;   // house footprint width  (x: −5 → +5)
const D  = 10;   // house footprint depth  (z: −5 → +5)

// Staircase: x −5→−2 (3 wide), z +2→−3 (5 deep), rises FH in 7 steps
const STEPS         = 7;
const STAIR_CX      = -3.5;
const STAIR_Z_START = 2;
const STAIR_TOTAL_Z = 5;
const STEP_H        = FH / STEPS;
const STEP_D        = STAIR_TOTAL_Z / STEPS;

// Window dimensions and Y centres per floor
const WIN_W  = 1.5;
const WIN_H  = 1.2;
const WIN1_CY = FT + 1.65;         // floor-1 window centre  ≈ 1.85
const WIN2_CY = FH + FT + 1.65;    // floor-2 window centre  ≈ 5.35

// Floor surface Y values
const F1Y = FT;        // 0.2
const F2Y = FH + FT;   // 3.7

// ── Low-level helpers ─────────────────────────────────────────────────

function staticBox(
    name: string, w: number, h: number, d: number,
    x: number, y: number, z: number,
    mat: StandardMaterial, scene: Scene,
) {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    m.material = mat;
    new PhysicsAggregate(m, PhysicsShapeType.BOX, { mass: 0, restitution: 0 }, scene);
    return m;
}

function decorBox(
    name: string, w: number, h: number, d: number,
    x: number, y: number, z: number,
    mat: StandardMaterial, scene: Scene,
) {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene);
    m.position.set(x, y, z);
    m.material = mat;
    m.isPickable = false;
    return m;
}

// ── Wall helpers with optional window cutout ───────────────────────────
//
// xWall — wall facing the Z axis (spans X).  Use for front / back walls.
// zWall — wall facing the X axis (spans Z).  Use for left / right walls.
//
// Pass winCentre = null for a solid wall with no window.

function xWall(
    name: string,
    xMin: number, xMax: number, yMin: number, yMax: number, z: number,
    winCx: number | null, winW: number, winH: number, winCy: number,
    wMat: StandardMaterial, gMat: StandardMaterial, scene: Scene,
) {
    if (winCx === null) {
        staticBox(name, xMax-xMin, yMax-yMin, T, (xMin+xMax)/2, (yMin+yMax)/2, z, wMat, scene);
        return;
    }
    const wx0 = winCx - winW/2, wx1 = winCx + winW/2;
    const wy0 = winCy - winH/2, wy1 = winCy + winH/2;
    if (wx0 > xMin) staticBox(`${name}_L`,   wx0-xMin,   yMax-yMin, T, (xMin+wx0)/2,  (yMin+yMax)/2, z, wMat, scene);
    if (wx1 < xMax) staticBox(`${name}_R`,   xMax-wx1,   yMax-yMin, T, (wx1+xMax)/2,  (yMin+yMax)/2, z, wMat, scene);
    if (wy0 > yMin) staticBox(`${name}_bot`, winW,       wy0-yMin,  T, winCx,          (yMin+wy0)/2,  z, wMat, scene);
    if (wy1 < yMax) staticBox(`${name}_top`, winW,       yMax-wy1,  T, winCx,          (wy1+yMax)/2,  z, wMat, scene);
    const g = MeshBuilder.CreateBox(`${name}_gl`, { width: winW, height: winH, depth: T*0.3 }, scene);
    g.position.set(winCx, winCy, z);  g.material = gMat;  g.isPickable = false;
}

function zWall(
    name: string,
    zMin: number, zMax: number, yMin: number, yMax: number, x: number,
    winCz: number | null, winW: number, winH: number, winCy: number,
    wMat: StandardMaterial, gMat: StandardMaterial, scene: Scene,
) {
    if (winCz === null) {
        staticBox(name, T, yMax-yMin, zMax-zMin, x, (yMin+yMax)/2, (zMin+zMax)/2, wMat, scene);
        return;
    }
    const wz0 = winCz - winW/2, wz1 = winCz + winW/2;
    const wy0 = winCy - winH/2, wy1 = winCy + winH/2;
    if (wz0 > zMin) staticBox(`${name}_F`,   T, yMax-yMin, wz0-zMin, x, (yMin+yMax)/2, (zMin+wz0)/2, wMat, scene);
    if (wz1 < zMax) staticBox(`${name}_B`,   T, yMax-yMin, zMax-wz1, x, (yMin+yMax)/2, (wz1+zMax)/2, wMat, scene);
    if (wy0 > yMin) staticBox(`${name}_bot`, T, wy0-yMin,  winW,     x, (yMin+wy0)/2,  winCz,        wMat, scene);
    if (wy1 < yMax) staticBox(`${name}_top`, T, yMax-wy1,  winW,     x, (wy1+yMax)/2,  winCz,        wMat, scene);
    const g = MeshBuilder.CreateBox(`${name}_gl`, { width: T*0.3, height: winH, depth: winW }, scene);
    g.position.set(x, winCy, winCz);  g.material = gMat;  g.isPickable = false;
}

// ── Main ──────────────────────────────────────────────────────────────

export function buildHouse(scene: Scene) {

    // ── Materials ─────────────────────────────────────────────────────
    const wallMat = new StandardMaterial("wallMat", scene);
    wallMat.diffuseColor = new Color3(0.88, 0.84, 0.76);

    const floorMat = new StandardMaterial("floorMat", scene);
    floorMat.diffuseColor = new Color3(0.50, 0.36, 0.20);

    const stepMat = new StandardMaterial("stepMat", scene);
    stepMat.diffuseColor = new Color3(0.65, 0.60, 0.54);

    const glassMat = new StandardMaterial("glassMat", scene);
    glassMat.diffuseColor    = new Color3(0.68, 0.88, 1.0);
    glassMat.specularColor   = new Color3(0.9,  0.95, 1.0);
    glassMat.alpha           = 0.22;
    glassMat.backFaceCulling = false;

    // Furniture
    const sofaMat = new StandardMaterial("sofaMat", scene);
    sofaMat.diffuseColor = new Color3(0.22, 0.22, 0.30);

    const darkWoodMat = new StandardMaterial("darkWoodMat", scene);
    darkWoodMat.diffuseColor = new Color3(0.28, 0.16, 0.07);

    const lightWoodMat = new StandardMaterial("lightWoodMat", scene);
    lightWoodMat.diffuseColor = new Color3(0.60, 0.42, 0.20);

    const rugMat = new StandardMaterial("rugMat", scene);
    rugMat.diffuseColor = new Color3(0.58, 0.10, 0.10);

    const mattressMat = new StandardMaterial("mattressMat", scene);
    mattressMat.diffuseColor = new Color3(0.92, 0.90, 0.85);

    const pillowMat = new StandardMaterial("pillowMat", scene);
    pillowMat.diffuseColor = new Color3(1.0, 0.95, 0.85);

    // ── Derived values ────────────────────────────────────────────────
    const midFloorY = FH + FT / 2;   // centre y of the mid-floor slab
    const y2        = FH + FT;        // floor-2 base y  (3.7)

    // ── Exterior ground ───────────────────────────────────────────────
    staticBox("ext_ground", 30, FT, 30, 0, FT/2, 0, floorMat, scene);

    // ── Floor 1 walls ─────────────────────────────────────────────────
    // Front — door gap x: −1 → +1; each side panel gets a window
    xWall("f1_fL", -5, -1, 0, FH, 5-T/2, -3.0, WIN_W, WIN_H, WIN1_CY, wallMat, glassMat, scene);
    xWall("f1_fR",  1,  5, 0, FH, 5-T/2,  3.0, WIN_W, WIN_H, WIN1_CY, wallMat, glassMat, scene);
    staticBox("f1_door_top", 2, 0.7, T, 0, FH-0.35, 5-T/2, wallMat, scene); // door lintel

    xWall("f1_back",  -5, 5, 0, FH, -5+T/2,  1.5, WIN_W, WIN_H, WIN1_CY, wallMat, glassMat, scene);
    zWall("f1_left",  -5, 5, 0, FH, -5+T/2,  0.0, WIN_W, WIN_H, WIN1_CY, wallMat, glassMat, scene);
    zWall("f1_right", -5, 5, 0, FH,  5-T/2,  0.0, WIN_W, WIN_H, WIN1_CY, wallMat, glassMat, scene);

    // ── Middle floor — three pieces around stairwell gap ─────────────
    // Gap: x −5→−2, z −3→+2
    staticBox("mid_right",      7,  FT, D,    1.5,  midFloorY,  0.0,  floorMat, scene);
    staticBox("mid_left_front", 3,  FT, 3,   -3.5,  midFloorY,  3.5,  floorMat, scene);
    staticBox("mid_left_back",  3,  FT, 2,   -3.5,  midFloorY, -4.0,  floorMat, scene);

    // ── Staircase ─────────────────────────────────────────────────────
    for (let i = 0; i < STEPS; i++) {
        decorBox(`step_${i}`, 3, STEP_H, STEP_D,
            STAIR_CX, i*STEP_H + STEP_H/2,
            STAIR_Z_START - i*STEP_D - STEP_D/2,
            stepMat, scene);
    }
    // Invisible physics ramp — smooth slope instead of individual step edges
    {
        const ang = Math.atan2(FH, STAIR_TOTAL_Z);
        const len = Math.sqrt(FH*FH + STAIR_TOTAL_Z*STAIR_TOTAL_Z);
        const ramp = MeshBuilder.CreateBox("stair_ramp", { width: 3, height: 0.15, depth: len }, scene);
        ramp.position.set(STAIR_CX, 1.95, -0.5);
        ramp.rotation.x = ang;
        ramp.isVisible  = false;
        ramp.isPickable = false;
        new PhysicsAggregate(ramp, PhysicsShapeType.BOX, { mass: 0, restitution: 0 }, scene);
    }

    // ── Floor 2 walls ─────────────────────────────────────────────────
    // Front: two windows (split at x = 0)
    xWall("f2_fL", -5, 0, y2, y2+FH, 5-T/2, -2.5, WIN_W, WIN_H, WIN2_CY, wallMat, glassMat, scene);
    xWall("f2_fR",  0, 5, y2, y2+FH, 5-T/2,  2.5, WIN_W, WIN_H, WIN2_CY, wallMat, glassMat, scene);
    xWall("f2_back",  -5, 5, y2, y2+FH, -5+T/2,  0.0,  WIN_W, WIN_H, WIN2_CY, wallMat, glassMat, scene);
    zWall("f2_left",  -5, 5, y2, y2+FH, -5+T/2, -1.5,  WIN_W, WIN_H, WIN2_CY, wallMat, glassMat, scene);
    zWall("f2_right", -5, 5, y2, y2+FH,  5-T/2,  1.5,  WIN_W, WIN_H, WIN2_CY, wallMat, glassMat, scene);

    // Roof
    staticBox("roof", W, FT, D, 0, y2+FH+FT/2, 0, floorMat, scene);

    // ── Furniture ─────────────────────────────────────────────────────
    buildF1Furniture(scene, sofaMat, darkWoodMat, lightWoodMat, rugMat);
    buildF2Furniture(scene, sofaMat, darkWoodMat, lightWoodMat, mattressMat, pillowMat);
}

// ─────────────────────────────────────────────────────────────────────
//  Floor 1 — living + dining (right side,  stairwell on left)
// ─────────────────────────────────────────────────────────────────────
function buildF1Furniture(
    scene: Scene,
    sofaMat: StandardMaterial, darkWood: StandardMaterial,
    lightWood: StandardMaterial, rugMat: StandardMaterial,
) {
    const fy = F1Y;   // 0.2

    // Rug
    decorBox("rug", 3.8, 0.02, 2.8, 2.5, fy+0.01, -1.5, rugMat, scene);

    // Sofa — faces +Z (looking toward coffee table), back toward right wall
    staticBox("sofa_seat", 2.2, 0.36, 0.88, 2.5, fy+0.18, -2.6, sofaMat, scene);
    staticBox("sofa_back", 2.2, 0.52, 0.20, 2.5, fy+0.54, -2.98, sofaMat, scene);
    staticBox("sofa_armL", 0.20, 0.40, 0.88, 1.30, fy+0.20, -2.6, sofaMat, scene);
    staticBox("sofa_armR", 0.20, 0.40, 0.88, 3.70, fy+0.20, -2.6, sofaMat, scene);

    // Coffee table
    staticBox("ctop", 1.3, 0.06, 0.75, 2.5, fy+0.44, -1.1, darkWood, scene);
    decorBox("cleg0", 0.06, 0.44, 0.06, 1.90, fy+0.22, -1.42, darkWood, scene);
    decorBox("cleg1", 0.06, 0.44, 0.06, 3.10, fy+0.22, -1.42, darkWood, scene);
    decorBox("cleg2", 0.06, 0.44, 0.06, 1.90, fy+0.22, -0.78, darkWood, scene);
    decorBox("cleg3", 0.06, 0.44, 0.06, 3.10, fy+0.22, -0.78, darkWood, scene);

    // Dining table
    staticBox("dtop", 2.0, 0.07, 1.1, 2.0, fy+0.77, 2.5, lightWood, scene);
    decorBox("dleg0", 0.07, 0.77, 0.07, 1.10, fy+0.385, 2.0,  lightWood, scene);
    decorBox("dleg1", 0.07, 0.77, 0.07, 2.90, fy+0.385, 2.0,  lightWood, scene);
    decorBox("dleg2", 0.07, 0.77, 0.07, 1.10, fy+0.385, 3.0,  lightWood, scene);
    decorBox("dleg3", 0.07, 0.77, 0.07, 2.90, fy+0.385, 3.0,  lightWood, scene);

    // Two dining chairs
    staticBox("dchair0_s", 0.46, 0.04, 0.46, 2.0, fy+0.44, 1.7,  lightWood, scene);
    staticBox("dchair0_b", 0.46, 0.40, 0.05, 2.0, fy+0.64, 1.5,  lightWood, scene);
    staticBox("dchair1_s", 0.46, 0.04, 0.46, 2.0, fy+0.44, 3.3,  lightWood, scene);
    staticBox("dchair1_b", 0.46, 0.40, 0.05, 2.0, fy+0.64, 3.5,  lightWood, scene);

    // Bookshelf against back wall (z = −5)
    staticBox("shelf",     1.2, 2.0, 0.34, 4.0, fy+1.0, -4.7, darkWood, scene);
    decorBox("shelf_s1",   1.2, 0.05, 0.34, 4.0, fy+0.68, -4.7, darkWood, scene);
    decorBox("shelf_s2",   1.2, 0.05, 0.34, 4.0, fy+1.38, -4.7, darkWood, scene);
}

// ─────────────────────────────────────────────────────────────────────
//  Floor 2
//
//  Solid floor map:
//    mid_right  → x: −2 → +5, z: −5 → +5   (large right zone)
//    mid_left_front → x: −5 → −2, z: +2 → +5
//    mid_left_back  → x: −5 → −2, z: −5 → −3
//  VOID (stairwell opening): x: −5 → −2, z: −3 → +2
//
//  Layout:
//    Bedroom  → x: 0.5 → 4.5, z: −5 → −0.5  (back-right, always solid)
//    Study    → x: 0.5 → 4.5, z:  0.5 → 4.5  (front-right, always solid)
//    Armchair → x: −5 → −2, z: −5 → −3       (left solid strip)
// ─────────────────────────────────────────────────────────────────────
function buildF2Furniture(
    scene: Scene,
    sofaMat: StandardMaterial, darkWood: StandardMaterial,
    lightWood: StandardMaterial,
    mattressMat: StandardMaterial, pillowMat: StandardMaterial,
) {
    const fy = F2Y;   // 3.7

    // Laptop screen material — emissive blue-ish glow
    const screenMat = new StandardMaterial("screenMat", scene);
    screenMat.diffuseColor  = new Color3(0.08, 0.14, 0.32);
    screenMat.emissiveColor = new Color3(0.04, 0.12, 0.30);

    // ── Bedroom  (back-right: x 0.5→4.5, z −5→−0.5) ─────────────────
    //
    // Headboard flush against back wall (inner face z = −4.7).
    // Depth 0.16 → centre at z = −4.7 + 0.08 = −4.62.
    staticBox("bed_head",   2.2, 0.85, 0.16, 2.5, fy+0.425, -4.62, darkWood, scene);

    // Bed frame: length 3.3, head end at z = −4.54 (headboard front face).
    // Centre z = −4.54 + 3.3/2 = −2.89.
    staticBox("bed_frame",  2.2, 0.22, 3.3, 2.5, fy+0.11,  -2.89, darkWood,    scene);
    staticBox("bed_mattr",  2.0, 0.22, 3.1, 2.5, fy+0.33,  -2.89, mattressMat, scene);
    decorBox ("bed_pillow", 0.8, 0.11, 0.52, 2.5, fy+0.555, -3.90, pillowMat,  scene);

    // Nightstand to the right of the bed (bed right edge x = 3.6, nightstand left x = 3.74)
    staticBox("nightstand", 0.52, 0.48, 0.52, 3.9, fy+0.24, -3.9, darkWood, scene);

    // Wardrobe against the RIGHT wall (inner face x = 4.7).
    // Width 0.52 along X → centre x = 4.7 − 0.26 = 4.44.
    // Depth 2.0 along Z, positioned in bedroom area.
    staticBox("wardrobe", 0.52, 2.6, 2.0, 4.44, fy+1.3, -2.0, darkWood, scene);
    // Door panels on the exposed (left) face of the wardrobe (x ≈ 4.18)
    decorBox("ward_d0", 0.04, 2.4, 0.94, 4.16, fy+1.3, -2.5, lightWood, scene);
    decorBox("ward_d1", 0.04, 2.4, 0.94, 4.16, fy+1.3, -1.5, lightWood, scene);

    // ── Study / office  (front-right: x 0.5→4.5, z 0.5→4.5) ─────────
    //
    // Desk against the FRONT wall (inner face z = 4.7).
    // Depth 0.72 along Z → centre z = 4.7 − 0.36 = 4.34.
    staticBox("desk_top",  1.6, 0.06, 0.72, 3.0, fy+0.78, 4.34, lightWood, scene);
    decorBox("dsk_l0", 0.06, 0.78, 0.06, 2.24, fy+0.39, 4.62, lightWood, scene); // back-left leg
    decorBox("dsk_l1", 0.06, 0.78, 0.06, 3.76, fy+0.39, 4.62, lightWood, scene); // back-right leg
    decorBox("dsk_l2", 0.06, 0.78, 0.06, 2.24, fy+0.39, 3.98, lightWood, scene); // front-left leg
    decorBox("dsk_l3", 0.06, 0.78, 0.06, 3.76, fy+0.39, 3.98, lightWood, scene); // front-right leg

    // Laptop on the desk surface (y = fy + 0.81).
    // Keyboard toward the front (z ≈ 4.15), screen standing at the back of the keyboard.
    decorBox("laptop_kb",     0.46, 0.02, 0.32, 3.0, fy+0.82, 4.15, darkWood,  scene);
    decorBox("laptop_screen", 0.46, 0.30, 0.02, 3.0, fy+0.97, 4.37, screenMat, scene);

    // Chair in front of desk (character faces +Z toward desk).
    staticBox("dchair_s", 0.48, 0.04, 0.48, 3.0, fy+0.44, 3.5,  sofaMat, scene);
    staticBox("dchair_b", 0.48, 0.38, 0.05, 3.0, fy+0.63, 3.26, sofaMat, scene);

    // ── Armchair in left solid strip (x −5→−2, z −5→−3) ─────────────
    staticBox("armchair_s", 0.8, 0.35, 0.8,  -3.5, fy+0.175, -4.0,  sofaMat, scene);
    staticBox("armchair_b", 0.8, 0.55, 0.18, -3.5, fy+0.525, -4.35, sofaMat, scene);
}
