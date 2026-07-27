import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Ray } from "@babylonjs/core/Culling/ray";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import "@babylonjs/loaders/glTF";
import {
    PhysicsCharacterController,
    CharacterSupportedState,
} from "@babylonjs/core/Physics/v2/characterController";

const SPEED    = 5;
const JUMP_VEL = 5.5;
const GRAVITY  = 9.81;

const CAM_DEFAULT_RADIUS = 9;
const CAM_MIN_RADIUS     = 2;
const CAM_MAX_RADIUS     = 20;

export async function createCharacter(engine: Engine, scene: Scene): Promise<() => void> {
    const canvas = engine.getRenderingCanvas()!;

    // ── Third-person camera ───────────────────────────────────────────
    const camera = new ArcRotateCamera("cam", Math.PI, Math.PI / 5, CAM_DEFAULT_RADIUS, Vector3.Zero(), scene);
    camera.inputs.clear();      // we drive alpha/beta/radius manually
    camera.lowerRadiusLimit = CAM_MIN_RADIUS;
    camera.upperRadiusLimit = CAM_MAX_RADIUS;
    camera.lowerBetaLimit   = 0.05;
    camera.upperBetaLimit   = Math.PI / 2.1;

    // desiredRadius = what the player wants (scroll wheel).
    // camera.radius  = actual radius, pulled in by wall-collision each frame.
    let desiredRadius = CAM_DEFAULT_RADIUS;

    // Pointer lock — click canvas to capture mouse, ESC to release
    let pointerLocked = false;
    const onPLC = () => { pointerLocked = document.pointerLockElement === canvas; };
    document.addEventListener("pointerlockchange", onPLC);

    canvas.addEventListener("click", () => {
        if (!pointerLocked) canvas.requestPointerLock().catch(() => {});
    });

    const onMouseMove = (e: MouseEvent) => {
        if (!pointerLocked) return;
        camera.alpha -= e.movementX * 0.003;
        // Inverted Y: mouse up → camera looks up (beta decreases)
        camera.beta = Math.max(
            camera.lowerBetaLimit!,
            Math.min(camera.upperBetaLimit!, camera.beta - e.movementY * 0.003),
        );
    };
    document.addEventListener("mousemove", onMouseMove);

    const onWheel = (e: WheelEvent) => {
        desiredRadius = Math.max(CAM_MIN_RADIUS, Math.min(CAM_MAX_RADIUS, desiredRadius + e.deltaY * 0.01));
        e.preventDefault();
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });

    // ── Physics character controller ──────────────────────────────────
    const startPos = new Vector3(0, 0.7, 7);
    const controller = new PhysicsCharacterController(
        startPos,
        { capsuleHeight: 1.5, capsuleRadius: 0.22 },
        scene,
    );
    controller.maxStepHeight    = 0.55;
    controller.maxSlopeCosine   = Math.cos(Math.PI * 55 / 180);

    // ── Character model ───────────────────────────────────────────────
    const CAPSULE_H = 1.5;   // must match PhysicsCharacterController capsuleHeight

    const root = new TransformNode("characterRoot", scene);
    root.position.copyFrom(startPos);

    // Fallback capsule shown only while the model loads (or on error)
    const bodyMat = new StandardMaterial("bodyMat", scene);
    bodyMat.diffuseColor = new Color3(0.2, 0.6, 1.0);
    const body = MeshBuilder.CreateCapsule("body", { radius: 0.22, height: CAPSULE_H, tessellation: 12 }, scene);
    body.material   = bodyMat;
    body.parent     = root;
    body.isPickable = false;

    let walkAnim: AnimationGroup | null = null;

    try {
        const result = await SceneLoader.ImportMeshAsync("", "/assets/", "the_perfect_steve_rigged.glb", scene);

        // Wrapper — all transforms applied here so they cascade to entire GLB hierarchy
        const modelWrapper = new TransformNode("modelWrapper", scene);
        modelWrapper.parent = root;

        // Attach every top-level GLB node to the wrapper (preserves internal hierarchy)
        for (const n of [...result.transformNodes, ...result.meshes]) {
            if (!n.parent) n.parent = modelWrapper;
        }
        for (const m of result.meshes) m.isPickable = false;

        // Auto-scale: read the actual bounding box so we don't guess values.
        // Target: model height = CAPSULE_H, feet aligned with capsule bottom.
        result.meshes.forEach(m => m.computeWorldMatrix(true));
        let minY = Infinity, maxY = -Infinity;
        for (const m of result.meshes) {
            if (m.getTotalVertices() === 0) continue;
            const bi = m.getBoundingInfo();
            minY = Math.min(minY, bi.boundingBox.minimumWorld.y);
            maxY = Math.max(maxY, bi.boundingBox.maximumWorld.y);
        }
        const rawH = maxY - minY;
        if (rawH > 0.001) {
            const minLocal = minY - root.position.y; // bottom relative to root
            const s = CAPSULE_H / rawH;
            modelWrapper.scaling.setAll(s);
            modelWrapper.position.y = -(CAPSULE_H / 2) - minLocal * s; // feet at capsule bottom
        }

        body.setEnabled(false);

        // This model has 1 animation: 'Armature.001|Walk'
        // No idle animation — model stays in default pose when standing still.
        const ags = result.animationGroups;
        for (const ag of ags) ag.stop();
        if (ags.length > 0) walkAnim = ags[0];
    } catch {
        // Model failed to load — capsule fallback remains visible
    }

    // ── Input ─────────────────────────────────────────────────────────
    const keys = { w: false, a: false, s: false, d: false, space: false };

    const onKeyDown = (e: KeyboardEvent) => {
        switch (e.key.toLowerCase()) {
            case "w": case "arrowup":    keys.w     = true; break;
            case "s": case "arrowdown":  keys.s     = true; break;
            case "a": case "arrowleft":  keys.a     = true; break;
            case "d": case "arrowright": keys.d     = true; break;
            case " ": keys.space = true; e.preventDefault(); break;
        }
    };
    const onKeyUp = (e: KeyboardEvent) => {
        switch (e.key.toLowerCase()) {
            case "w": case "arrowup":    keys.w     = false; break;
            case "s": case "arrowdown":  keys.s     = false; break;
            case "a": case "arrowleft":  keys.a     = false; break;
            case "d": case "arrowright": keys.d     = false; break;
            case " ": keys.space = false; break;
        }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup",   onKeyUp);

    // ── Per-frame update ──────────────────────────────────────────────
    // Vertical velocity is tracked manually so we control gravity precisely.
    // We pass Vector3.Zero() to integrate() and do NOT use getVelocity().y,
    // which only reflects the value we last set — not post-physics gravity.
    let verticalVel  = 0;
    let jumpConsumed = false;

    scene.onBeforeRenderObservable.add(() => {
        const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);
        if (dt <= 0) return;

        const surfaceInfo = controller.checkSupport(dt, Vector3.Down());
        const grounded    = surfaceInfo.supportedState === CharacterSupportedState.SUPPORTED;

        // --- Vertical velocity -------------------------------------------
        if (grounded) {
            if (verticalVel < 0) verticalVel = 0;         // reset on landing
            if (keys.space && !jumpConsumed) {
                verticalVel  = JUMP_VEL;
                jumpConsumed = true;
            }
        } else {
            verticalVel -= GRAVITY * dt;
            verticalVel  = Math.max(verticalVel, -18);    // terminal velocity
            if (!keys.space) jumpConsumed = false;
        }

        // --- Horizontal movement (relative to camera) --------------------
        const camToTarget = camera.target.subtract(camera.position);
        const forward = new Vector3(camToTarget.x, 0, camToTarget.z).normalize();
        const right   = new Vector3(forward.z, 0, -forward.x);

        let mx = 0, mz = 0;
        if (keys.w) { mx += forward.x; mz += forward.z; }
        if (keys.s) { mx -= forward.x; mz -= forward.z; }
        if (keys.a) { mx -= right.x;   mz -= right.z;   }
        if (keys.d) { mx += right.x;   mz += right.z;   }

        const moving = mx !== 0 || mz !== 0;
        const len = Math.sqrt(mx * mx + mz * mz);
        if (len > 1) { mx /= len; mz /= len; }

        controller.setVelocity(new Vector3(mx * SPEED, verticalVel, mz * SPEED));
        controller.integrate(dt, surfaceInfo, Vector3.Zero());

        // --- Sync visuals ------------------------------------------------
        const pos = controller.getPosition();
        root.position.copyFrom(pos);
        camera.target.set(pos.x, pos.y + 0.5, pos.z);

        // --- Camera collision / auto-zoom --------------------------------
        // Cast a ray from the character target toward where the camera wants to be.
        // If the ray hits a wall before reaching desiredRadius, pull the camera in.
        const toCam = camera.position.subtract(camera.target);
        const toCamLen = toCam.length();
        if (toCamLen > 0.01) {
            const dir = toCam.scale(1 / toCamLen);
            const ray = new Ray(camera.target, dir, desiredRadius + 0.5);
            const pick = scene.pickWithRay(ray);

            let targetRadius = desiredRadius;
            if (pick?.hit && pick.pickedPoint) {
                const hitDist = Vector3.Distance(camera.target, pick.pickedPoint);
                if (hitDist < desiredRadius) {
                    targetRadius = Math.max(CAM_MIN_RADIUS, hitDist - 0.25);
                }
            }

            // Snap in quickly when a wall is close; ease back out slowly.
            const speed = targetRadius < camera.radius ? 18 : 4;
            camera.radius += (targetRadius - camera.radius) * Math.min(1, dt * speed);
        }

        // --- Rotate character toward movement direction (smooth) ---------
        if (moving) {
            const targetAngle = Math.atan2(mx, mz);
            let diff = targetAngle - root.rotation.y;
            while (diff >  Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;
            root.rotation.y += diff * Math.min(1, dt * 12);
        }

        // Animation: play Walk while moving, stop when idle
        if (moving) {
            if (walkAnim && !walkAnim.isPlaying) walkAnim.play(true);
        } else {
            if (walkAnim?.isPlaying) walkAnim.stop();
        }
    });

    return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup",   onKeyUp);
        document.removeEventListener("pointerlockchange", onPLC);
        document.removeEventListener("mousemove", onMouseMove);
        canvas.removeEventListener("wheel", onWheel);
        controller.dispose();
        if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
}
