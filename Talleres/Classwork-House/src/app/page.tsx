"use client";

import { useEffect, useRef, useState } from "react";
import { Scene } from "@babylonjs/core/scene";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin";
import HavokPhysics from "@babylonjs/havok";

// Required side-effect registrations
import "@babylonjs/core/Physics";
import "@babylonjs/core/Meshes/meshBuilder";
import "@babylonjs/core/Materials/standardMaterial";
import "@babylonjs/core/Lights/hemisphericLight";
import "@babylonjs/core/Lights/directionalLight";
import "@babylonjs/core/Loading/loadingScreen";

import { setupScene } from "@/game/scene";

export default function Home() {
    const canvasRef  = useRef<HTMLCanvasElement>(null);
    const [locked, setLocked] = useState(false);

    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;

        const engine = new Engine(canvas, true, {
            antialias: true,
            adaptToDeviceRatio: true,
            powerPreference: "high-performance",
        });
        const scene = new Scene(engine);

        let cleanup: (() => void) | undefined;

        (async () => {
            const havok = await HavokPhysics();
            scene.enablePhysics(new Vector3(0, -9.81, 0), new HavokPlugin(true, havok));
            cleanup = await setupScene(engine, scene);
            engine.runRenderLoop(() => scene.render());
        })();

        const onResize = () => engine.resize();
        window.addEventListener("resize", onResize);

        // Track pointer lock state for the hint overlay
        const onPLC = () => setLocked(document.pointerLockElement === canvas);
        document.addEventListener("pointerlockchange", onPLC);

        // Suppress right-click context menu on canvas
        canvas.addEventListener("contextmenu", (e) => e.preventDefault());

        return () => {
            cleanup?.();
            scene.dispose();
            engine.dispose();
            window.removeEventListener("resize", onResize);
            document.removeEventListener("pointerlockchange", onPLC);
        };
    }, []);

    return (
        <main className="flex w-screen h-screen relative">
            <canvas
                ref={canvasRef}
                className="w-full h-full outline-none select-none"
            />
            {!locked && (
                <div
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                    style={{ background: "rgba(0,0,0,0.35)" }}
                >
                    <div style={{
                        color: "white",
                        textAlign: "center",
                        fontFamily: "system-ui, sans-serif",
                        textShadow: "0 2px 6px rgba(0,0,0,0.8)",
                    }}>
                        <p style={{ fontSize: "1.6rem", fontWeight: 700, marginBottom: 8 }}>
                            Click to play
                        </p>
                        <p style={{ fontSize: "0.9rem", opacity: 0.85 }}>
                            WASD — move &nbsp;|&nbsp; Mouse — look &nbsp;|&nbsp; Space — jump &nbsp;|&nbsp; ESC — unlock mouse
                        </p>
                    </div>
                </div>
            )}
        </main>
    );
}
