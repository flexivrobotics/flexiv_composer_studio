<template>
	<div class="mesh-pose-preview" ref="mountEl"></div>
</template>

<script setup lang="ts">
// ── MeshPosePreview ──────────────────────────────────────────────────
// Small standalone Three.js canvas (its own scene/camera/renderer, not the
// main viewport) for previewing a visual mesh and/or collision mesh together
// with one or more poses (drawn as axes helpers) before the component is
// saved. Meshes are loaded from local File objects via blob URLs.

import { onMounted, onUnmounted, ref, watch } from 'vue';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadMeshFromUrl } from '../../services/sceneLoader';
import { rpyToQuaternion } from '../../services/kinematics';

interface Pose {
	x: number;
	y: number;
	z: number;
	roll: number;
	pitch: number;
	yaw: number;
	label?: string;
}

const props = defineProps<{
	visualFile: File | null;
	collisionFile: File | null;
	poses: Pose[];
}>();

const mountEl = ref<HTMLDivElement | null>(null);

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
let resizeObserver: ResizeObserver | null = null;
let animationFrameId = 0;

let visualGroup = new THREE.Group();
let collisionGroup = new THREE.Group();
let worldGroup = new THREE.Group();
let posesGroup = new THREE.Group();

// ── Lifecycle ────────────────────────────────────────────────────────

onMounted(() => {
	const el = mountEl.value;
	if (!el) return;

	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xf7fafd);
	scene.add(visualGroup, collisionGroup, worldGroup, posesGroup);
	scene.add(new THREE.AmbientLight(0xffffff, 0.6));
	const dir = new THREE.DirectionalLight(0xffffff, 1.0);
	dir.position.set(2, 3, 2);
	scene.add(dir);

	const { clientWidth, clientHeight } = el;
	camera = new THREE.PerspectiveCamera(45, (clientWidth || 1) / (clientHeight || 1), 0.01, 100);
	camera.up.set(0, 0, 1);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(clientWidth, clientHeight, false);
	el.appendChild(renderer.domElement);

	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.08;

	resetView();

	resizeObserver = new ResizeObserver(() => resize());
	resizeObserver.observe(el);

	animate();
	rebuildWorldFrame();
	rebuildPoses();
	reloadVisual();
	reloadCollision();
});

onUnmounted(() => {
	if (animationFrameId) cancelAnimationFrame(animationFrameId);
	resizeObserver?.disconnect();
	clearGroup(visualGroup);
	clearGroup(collisionGroup);
	clearGroup(worldGroup);
	clearGroup(posesGroup);
	if (renderer) {
		renderer.dispose();
		renderer.domElement.parentElement?.removeChild(renderer.domElement);
	}
	scene = null;
	camera = null;
	renderer = null;
	controls = null;
});

// ── Render Loop ────────────────────────────────────────────────────────

function animate() {
	animationFrameId = requestAnimationFrame(animate);
	controls?.update();
	if (renderer && scene && camera) renderer.render(scene, camera);
}

function resize() {
	const el = mountEl.value;
	if (!el || !renderer || !camera) return;
	const { clientWidth, clientHeight } = el;
	if (!clientWidth || !clientHeight) return;
	renderer.setSize(clientWidth, clientHeight, false);
	camera.aspect = clientWidth / clientHeight;
	camera.updateProjectionMatrix();
}

// ── Mesh Loading ───────────────────────────────────────────────────────

function clearGroup(group: THREE.Group) {
	for (const child of [...group.children]) {
		group.remove(child);
		child.traverse((obj) => {
			if (obj instanceof THREE.Mesh) {
				obj.geometry?.dispose();
				const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
				materials.forEach((m) => m?.dispose());
			} else if (obj instanceof THREE.Sprite) {
				obj.material.map?.dispose();
				obj.material.dispose();
			}
		});
	}
}

/** A small always-camera-facing text label rendered via a canvas texture. */
function createLabelSprite(text: string, worldHeight: number): THREE.Sprite {
	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d')!;
	const fontSize = 48;
	ctx.font = `${fontSize}px sans-serif`;
	const textWidth = ctx.measureText(text).width;
	canvas.width = textWidth + 24;
	canvas.height = fontSize + 16;
	ctx.font = `${fontSize}px sans-serif`;
	ctx.fillStyle = '#000000';
	ctx.textBaseline = 'middle';
	ctx.fillText(text, 12, canvas.height / 2);

	const texture = new THREE.CanvasTexture(canvas);
	texture.minFilter = THREE.LinearFilter;
	const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
	const sprite = new THREE.Sprite(material);
	const aspect = canvas.width / canvas.height;
	sprite.scale.set(worldHeight * aspect, worldHeight, 1);
	return sprite;
}

/** Axes helper size (and matching label height) scaled to whatever's loaded, so
 * frames stay legible whether the meshes are millimeter-scale or meter-scale. */
function referenceScale(): number {
	const box = new THREE.Box3();
	box.expandByObject(visualGroup);
	box.expandByObject(collisionGroup);
	if (box.isEmpty()) return 0.05;
	const size = box.getSize(new THREE.Vector3()).length();
	return THREE.MathUtils.clamp(size * 0.12, 0.005, 0.5);
}

function addFrame(group: THREE.Group, position: THREE.Vector3, quaternion: THREE.Quaternion, label: string, scale: number) {
	const axes = new THREE.AxesHelper(scale);
	axes.position.copy(position);
	axes.quaternion.copy(quaternion);
	group.add(axes);

	const sprite = createLabelSprite(label, scale * 0.35);
	sprite.position.copy(position).addScaledVector(new THREE.Vector3(1, 1, 1).normalize(), scale * 0.4);
	group.add(sprite);
}

async function loadFileIntoGroup(file: File, group: THREE.Group, tint?: number) {
	clearGroup(group);
	const ext = file.name.split('.').pop()?.toLowerCase();
	const url = URL.createObjectURL(file);
	try {
		const loaded = await loadMeshFromUrl(url, ext);
		if (tint !== undefined) {
			loaded.traverse((obj) => {
				if (obj instanceof THREE.Mesh) {
					obj.material = new THREE.MeshBasicMaterial({
						color: tint,
						transparent: true,
						opacity: 0.35,
						depthWrite: false,
						wireframe: true,
					});
				}
			});
		}
		group.add(loaded);
		rebuildWorldFrame();
		rebuildPoses();
		frameView();
	} catch (err) {
		console.warn('Failed to load mesh preview:', err);
	} finally {
		URL.revokeObjectURL(url);
	}
}

function reloadVisual() {
	if (props.visualFile) loadFileIntoGroup(props.visualFile, visualGroup);
	else clearGroup(visualGroup);
}

function reloadCollision() {
	if (props.collisionFile) loadFileIntoGroup(props.collisionFile, collisionGroup, 0xff8800);
	else clearGroup(collisionGroup);
}

// ── Frames (Axes Helpers + Labels) ────────────────────────────────────

function rebuildWorldFrame() {
	clearGroup(worldGroup);
	const scale = referenceScale();
	addFrame(worldGroup, new THREE.Vector3(0, 0, 0), new THREE.Quaternion(), 'World', scale);
}

function rebuildPoses() {
	clearGroup(posesGroup);
	const scale = referenceScale();
	props.poses.forEach((pose, i) => {
		const quat = rpyToQuaternion(pose.roll, pose.pitch, pose.yaw);
		addFrame(
			posesGroup,
			new THREE.Vector3(pose.x, pose.y, pose.z),
			new THREE.Quaternion(quat.x, quat.y, quat.z, quat.w),
			pose.label || `Pose ${i + 1}`,
			scale,
		);
	});
	frameView();
}

// ── Camera Framing ───────────────────────────────────────────────────

function resetView() {
	if (!camera || !controls) return;
	camera.position.set(0.2, 0.2, 0.2);
	controls.target.set(0, 0, 0);
	camera.lookAt(controls.target);
}

function frameView() {
	if (!camera || !controls || !scene) return;
	const box = new THREE.Box3();
	box.expandByObject(visualGroup);
	box.expandByObject(collisionGroup);
	box.expandByObject(worldGroup);
	box.expandByObject(posesGroup);
	if (box.isEmpty()) {
		resetView();
		return;
	}
	const center = box.getCenter(new THREE.Vector3());
	const size = box.getSize(new THREE.Vector3());
	const radius = Math.max(size.length() * 0.5, 0.02);
	const dir = new THREE.Vector3(1, 1, 1).normalize();
	camera.position.copy(center).addScaledVector(dir, radius * 2.5);
	camera.near = radius / 100;
	camera.far = radius * 100;
	camera.updateProjectionMatrix();
	controls.target.copy(center);
	camera.lookAt(center);
}

// ── Watchers ─────────────────────────────────────────────────────────

watch(() => props.visualFile, reloadVisual);
watch(() => props.collisionFile, reloadCollision);
watch(() => props.poses, rebuildPoses, { deep: true });
</script>

<style scoped>
.mesh-pose-preview {
	width: 100%;
	height: 220px;
	border: 1px solid var(--line);
	border-radius: 6px;
	overflow: hidden;
}
</style>
