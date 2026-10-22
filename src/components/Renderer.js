import * as THREE from "three";
import { screenWidth, screenHeight } from "../screenSize.js";

export function Renderer() {
    const canvas = document.querySelector("canvas.game");
    if (!canvas) throw new Error("Canvas not found");

    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        canvas: canvas,
    });

    // The canvas fills the screen through CSS (style.css); this only sets
    // how many pixels it draws
    function fitScreen() {
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(screenWidth(), screenHeight(), false);
    }
    fitScreen();
    window.addEventListener("resize", fitScreen);

    return renderer;
}
