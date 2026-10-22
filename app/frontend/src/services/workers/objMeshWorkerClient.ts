// Main-thread client for objMeshWorker.ts — sends a URL, gets back raw
// geometry buffers, and assembles them into a THREE.Group. Reconstructing
// BufferGeometry from already-parsed typed arrays is cheap (no re-parsing),
// so this keeps the main thread free while the worker does the heavy OBJ
// text parsing.
import * as THREE from 'three';

interface MeshPayload {
	name: string;
	position: Float32Array;
	normal: Float32Array | null;
	uv: Float32Array | null;
	color: Float32Array | null;
	index: Uint32Array | null;
}

type WorkerResponse =
	| { id: number; ok: true; meshes: MeshPayload[] }
	| { id: number; ok: false; error: string };

let _worker: Worker | null = null;
let _nextId = 0;
const _pending = new Map<number, { resolve: (group: THREE.Group) => void; reject: (err: Error) => void }>();

function createVisualMaterial(): THREE.MeshStandardMaterial {
	return new THREE.MeshStandardMaterial({ color: 0xc0b8a8, roughness: 0.70, metalness: 0.15 });
}

function getWorker(): Worker {
	if (_worker) return _worker;
	_worker = new Worker(new URL('./objMeshWorker.ts', import.meta.url), { type: 'module' });
	_worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
		const pending = _pending.get(ev.data.id);
		if (!pending) return;
		_pending.delete(ev.data.id);
		if (!ev.data.ok) {
			pending.reject(new Error(ev.data.error));
			return;
		}
		const group = new THREE.Group();
		for (const m of ev.data.meshes) {
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
			if (m.normal) geometry.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
			else geometry.computeVertexNormals();
			if (m.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2));
			if (m.color) geometry.setAttribute('color', new THREE.BufferAttribute(m.color, 3));
			if (m.index) geometry.setIndex(new THREE.BufferAttribute(m.index, 1));

			const material = m.color
				? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.70, metalness: 0.15 })
				: createVisualMaterial();
			const mesh = new THREE.Mesh(geometry, material);
			mesh.name = m.name;
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			group.add(mesh);
		}
		pending.resolve(group);
	};
	_worker.onerror = (ev) => {
		for (const [, p] of _pending) p.reject(new Error(ev.message || 'OBJ mesh worker error'));
		_pending.clear();
	};
	return _worker;
}

/** Fetch + parse an OBJ file off the main thread; returns an assembled THREE.Group. */
export function loadObjMeshOffMainThread(url: string): Promise<THREE.Group> {
	const worker = getWorker();
	const id = _nextId++;
	return new Promise((resolve, reject) => {
		_pending.set(id, { resolve, reject });
		worker.postMessage({ id, url });
	});
}
