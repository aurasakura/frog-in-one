import * as THREE from 'three';
import './style.css';
import { Renderer } from './components/Renderer.js';
import { Camera, updateCamera, turnCamera } from './components/Camera.js';
import { player } from './components/Player.js';
import { aimGuide } from './components/AimGuide.js';
import { splash, mudSplat } from './components/Splash.js';
import { dust, sparkles, confetti, frogShadow } from './components/Effects.js';
import { updateLevel } from './levels/levelBuilder.js';
import { initInput, takeViewTurn } from './input.js';
import { updatePhysics, updateModel, getFrog, hop, isMidHop, canAim } from './physics.js';
import { updateHud, getStrokes } from './hud.js';
import { updateTutorial } from './tutorial.js';
import { game, isPlaying, isCutscene, initGameState, updateGameState, getIntroProgress } from './gameState.js';
import { isCutsceneRunning, updateCutscene } from './cutscenes.js';
import { TitleScene } from './components/TitleScene.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color('#87CEEB'); // sky
scene.add(player);
scene.add(aimGuide.object);
for (const effect of [splash, mudSplat, dust, sparkles, confetti, frogShadow]) {
  scene.add(effect.object);
}

const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(-100, -100, 200);
scene.add(dirLight);

const camera = Camera(); // chase camera, moved every frame below

const title = TitleScene(); // Froggy on his lily pad, behind the title screen

// The title screen covers the canvas, so it passes on clicks on Froggy (he
// backflips) and shows a pointer over him; the menu keeps its own clicks
const titleScreen = document.querySelector('.title-screen');
titleScreen.addEventListener('click', (event) => {
  if (!event.target.closest('.title-menu')) title.click(event.clientX, event.clientY);
});
titleScreen.addEventListener('pointermove', (event) => {
  const over = !event.target.closest('.title-menu') && title.isOverFrog(event.clientX, event.clientY);
  titleScreen.style.cursor = over ? 'pointer' : '';
});

const renderer = Renderer();
initInput(renderer.domElement, camera, player, canAim);

initGameState(scene, camera); // title screen over level 1

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const delta = Math.min(clock.getDelta(), 0.1); // don't jump after a stall

  updateGameState(delta); // state machine: menus, banner, pause, stars, cutscenes

  // Title screen (and level select opened from it): the title scene instead
  if (game.state === 'title' || (game.state === 'levelSelect' && game.levelSelectFrom === 'title')) {
    title.update(delta);
    renderer.render(title.scene, title.camera);
    return;
  }

  if (game.state !== 'paused') {
    if (isPlaying()) {
      updatePhysics(delta); // aiming, flight, landing, sliding, powerups
      updateHud(delta); // strokes + level timer
    }
    updateLevel(delta, getFrog()); // slime wobble, flies, obstacles
    for (const effect of [splash, mudSplat, dust, sparkles, confetti]) effect.update(delta);
    if (!isCutscene()) updateModel(delta); // facing, squash & stretch, shadow, flip
  }

  // A cutscene drives the camera itself; otherwise the chase camera follows
  // (right-drag turns it around Froggy to look about)
  const turn = takeViewTurn();
  turnCamera(camera, turn);
  if (isPlaying() || game.state === 'levelComplete') {
    // Controls walkthrough (level 1): advances as each step is done
    updateTutorial({
      aimPower: hop.aimPower,
      strokes: getStrokes(),
      powerupsUsed: hop.powerupsUsed,
      levelComplete: game.state === 'levelComplete',
      turn,
    });
  }
  if (isCutsceneRunning()) updateCutscene(delta, camera);
  else updateCamera(camera, player.position, hop.heading, isMidHop(), delta, hop.aimPower, game.state === 'levelComplete', getIntroProgress());

  renderer.render(scene, camera);
});
