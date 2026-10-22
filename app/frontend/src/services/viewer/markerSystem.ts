import * as THREE from 'three';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

// ── MarkerSystem ──────────────────────────────────────────────────────
// Extracted from SceneViewer.  Manages preview / interaction markers:
//   • Sphere markers placed at click points on named objects.
//   • Connection lines between sequential click points (per object).
//   • Thick path‑segment lines showing generated intermediate toolpath
//     points (per object).
//
// The system owns its own GPU resources and exposes add / clear / resize
// operations.  All Three.js scene and renderer interaction is delegated
// through the constructor‑injected dependencies.

export class MarkerSystem {
	private readonly _scene: THREE.Scene;
	private readonly _renderer: THREE.WebGLRenderer;

	/** Per‑object marker groups (sphere visuals for click points). */
	private _markerGroups = new Map<string, THREE.Group>();

	/** Per‑object connection line between click points. */
	private _markerLines = new Map<string, THREE.Line>();

	/** Per‑object path‑segment lines (from toolpath generation). */
	private _pathLines = new Map<string, THREE.Line[]>();

	constructor(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
		this._scene = scene;
		this._renderer = renderer;
	}

	// ── Public Marker API ───────────────────────────────────────────

	/** Add a sphere marker at the given world-space point for a named object. */
	addMarker(name: string, point: { x: number; y: number; z: number }): void {
		let mg = this._markerGroups.get(name);
		if (!mg) {
			mg = new THREE.Group();
			mg.name = `__markers_${name}`;
			this._scene.add(mg);
			this._markerGroups.set(name, mg);
		}

		const sphere = new THREE.Mesh(
			new THREE.SphereGeometry(0.02, 12, 12),
			new THREE.MeshStandardMaterial({
				color: 0x4488ff,
				emissive: 0x2266ff,
				emissiveIntensity: 0.4,
			}),
		);
		sphere.position.set(point.x, point.y, point.z);
		mg.add(sphere);
	}

	/**
	 * Add thick line segments through intermediate toolpath points.
	 * Each call creates a new line added to a per-object segment array.
	 */
	addIntermediateMarkers(name: string, points: { x: number; y: number; z: number }[]): void {
		if (points.length < 2) return;

		const size = new THREE.Vector2();
		this._renderer.getSize(size);

		const positions: number[] = [];
		for (const p of points) {
			positions.push(p.x, p.y, p.z);
		}

		const geometry = new LineGeometry();
		geometry.setPositions(positions);

		const material = new LineMaterial({
			color: 0x4488ff,
			linewidth: 3,
			resolution: size,
		});

		const line = new Line2(geometry, material);
		line.computeLineDistances();
		this._scene.add(line as unknown as THREE.Line);

		let segments = this._pathLines.get(name);
		if (!segments) {
			segments = [];
			this._pathLines.set(name, segments);
		}
		segments.push(line as unknown as THREE.Line);
	}

	/** Remove all markers and lines for a single named object. */
	clearMarkers(name: string): void {
		const mg = this._markerGroups.get(name);
		if (mg) {
			this._scene.remove(mg);
			this._disposeGroupResources(mg);
			this._markerGroups.delete(name);
		}

		const line = this._markerLines.get(name);
		if (line) {
			this._scene.remove(line);
			line.geometry.dispose();
			(line.material as THREE.Material)?.dispose();
			this._markerLines.delete(name);
		}

		const segments = this._pathLines.get(name);
		if (segments) {
			for (const seg of segments) {
				this._scene.remove(seg);
				seg.geometry.dispose();
				(seg.material as THREE.Material)?.dispose();
			}
			this._pathLines.delete(name);
		}
	}

	/** Remove all markers and lines for every named object. */
	clearAllMarkers(): void {
		for (const name of Array.from(this._markerGroups.keys())) {
			this.clearMarkers(name);
		}
	}

	/**
	 * Update the screen‑resolution uniforms on all LineMaterial instances.
	 * Call this when the renderer canvas is resized.
	 */
	updateResolutions(width: number, height: number, pixelRatio: number): void {
		const size = new THREE.Vector2(width * pixelRatio, height * pixelRatio);
		const updateRes = (mat: THREE.Material) => {
			if (mat instanceof LineMaterial) {
				mat.resolution.set(size.x, size.y);
				mat.needsUpdate = true;
			}
		};
		for (const line of this._markerLines.values()) updateRes(line.material as THREE.Material);
		for (const segs of this._pathLines.values()) {
			for (const s of segs) updateRes(s.material as THREE.Material);
		}
	}

	/** Dispose all marker GPU resources (scene/ renderer are NOT disposed). */
	dispose(): void {
		this.clearAllMarkers();
	}

	// ── Private Helpers ─────────────────────────────────────────────

	/** Update or create the connecting line through all sphere markers for a named object. */
	private _updateConnectionLine(name: string): void {
		const mg = this._markerGroups.get(name);
		if (!mg || mg.children.length < 2) {
			const old = this._markerLines.get(name);
			if (old) {
				this._scene.remove(old);
				old.geometry.dispose();
				(old.material as THREE.Material)?.dispose();
				this._markerLines.delete(name);
			}
			return;
		}

		const positions: number[] = [];
		for (const child of mg.children) {
			positions.push(child.position.x, child.position.y, child.position.z);
		}

		const size = new THREE.Vector2();
		this._renderer.getSize(size);

		const geometry = new LineGeometry();
		geometry.setPositions(positions);

		const material = new LineMaterial({
			color: 0x4488ff,
			linewidth: 2,
			resolution: size,
		});

		const line = new Line2(geometry, material);
		line.computeLineDistances();

		const old = this._markerLines.get(name);
		if (old) {
			this._scene.remove(old);
			old.geometry.dispose();
			(old.material as THREE.Material)?.dispose();
		}

		this._scene.add(line as unknown as THREE.Line);
		this._markerLines.set(name, line as unknown as THREE.Line);
	}

	private _disposeGroupResources(group: THREE.Group): void {
		group.traverse((obj) => {
			if (obj instanceof THREE.Mesh) {
				obj.geometry.dispose();
				if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
				else obj.material?.dispose();
			}
		});
	}
}
