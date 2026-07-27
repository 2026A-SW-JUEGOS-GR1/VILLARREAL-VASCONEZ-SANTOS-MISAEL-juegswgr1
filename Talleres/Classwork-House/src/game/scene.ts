import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { PointLight } from "@babylonjs/core/Lights/pointLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { buildHouse } from "./house";
import { createCharacter } from "./character";

export async function setupScene(engine: Engine, scene: Scene): Promise<() => void> {

    // ── Night sky ─────────────────────────────────────────────────────
    scene.clearColor = new Color4(0.01, 0.01, 0.05, 1);

    // Very dim moonlight — just enough to see the silhouette of the house outside.
    // Indoor point lights dominate once the character enters.
    const hemi = new HemisphericLight("hemi", new Vector3(0, 1, 0), scene);
    hemi.intensity   = 0.04;
    hemi.diffuse     = new Color3(0.45, 0.55, 0.80);
    hemi.groundColor = new Color3(0.05, 0.05, 0.10);

    const moon = new DirectionalLight("moon", new Vector3(-0.3, -1, -0.5).normalize(), scene);
    moon.intensity = 0.06;
    moon.diffuse   = new Color3(0.5, 0.6, 1.0);
    moon.position.set(20, 30, 20);

    buildHouse(scene);

    // ── Interior lights ───────────────────────────────────────────────
    //
    // Floor 1 — two ceiling fixtures, one per functional zone.
    //   Living area  (right side, x>0, z<1)
    //   Dining area  (right side, x>0, z>1)
    addBulb(scene, "f1_living", new Vector3( 2.0, 3.1, -1.0), "#FFD060", 1.5, 10);
    addBulb(scene, "f1_dining", new Vector3( 2.0, 3.1,  2.5), "#FFD060", 1.4,  9);

    // Stairwell — mid-height pendant, warm orange so it reads as a separate zone.
    addBulb(scene, "stair",     new Vector3(-3.5, 2.2, -0.5), "#FFA840", 1.1,  7);

    // Floor 2 — pendant lights hung at mid-height (y ≈ 5.1) so they are
    //   only 1.4 units above the floor surface (3.7) → strong floor illumination.
    //   Bedroom (back-right) and study (front-right) match the new furniture layout.
    addBulb(scene, "f2_bedroom", new Vector3( 2.0, 5.1, -2.5), "#FFE080", 1.7, 10);
    addBulb(scene, "f2_study",   new Vector3( 2.5, 5.1,  2.5), "#FFE080", 1.7, 10);

    // Exterior entrance lantern — mounted just above the door frame.
    addBulb(scene, "entrance",  new Vector3( 0.0, 3.4,  5.4), "#FF9030", 0.9,  5);

    const cleanup = await createCharacter(engine, scene);
    return cleanup;
}

// Creates a PointLight at `position` plus a small emissive sphere that
// acts as the visible bulb. The sphere colour matches the light colour.
function addBulb(
    scene: Scene, name: string, position: Vector3,
    hex: string, intensity: number, range: number,
): void {
    const color = Color3.FromHexString(hex);

    const light     = new PointLight(name, position, scene);
    light.diffuse   = color;
    light.specular  = color.scale(0.35);
    light.intensity = intensity;
    light.range     = range;

    // Visible bulb mesh — emissive, unaffected by other lights
    const mat = new StandardMaterial(`${name}_mat`, scene);
    mat.emissiveColor   = color;
    mat.disableLighting = true;

    const mesh = MeshBuilder.CreateSphere(`${name}_mesh`, { diameter: 0.14, segments: 5 }, scene);
    mesh.position.copyFrom(position);
    mesh.material   = mat;
    mesh.isPickable = false;
}
