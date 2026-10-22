// Parses an OBJ file off the main thread. OBJLoader.parse() (three.js) is a
// single synchronous pass over the whole file with no chunking/yielding — for
// a large scan/reconstruction mesh (potentially derived from up to a million
// points) that can block the tab for seconds. This worker does the fetch +
// parse here instead, and posts back only the raw geometry buffers (as
// Transferable ArrayBuffers, zero-copy) for the main thread to assemble into
// THREE.Mesh objects, which is cheap.
//
// Deliberately scoped to material-less OBJs (see loadMeshFromUrl): meshes
// with a companion .mtl/.mat file are typically small hand-authored parts and
// keep using the original main-thread OBJLoader path, since replicating
// per-material assignment through this postMessage protocol isn't worth the
// complexity for meshes that were never the freeze risk.
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

interface MeshPayload {
	name: string;
	position: Float32Array;
	normal: Float32Array | null;
	uv: Float32Array | null;
	color: Float32Array | null;
	index: Uint32Array | null;
}

type WorkerRequest = { id: number; url: string };
type WorkerResponse =
	| { id: number; ok: true; meshes: MeshPayload[] }
	| { id: number; ok: false; error: string };

// No "webworker" lib in tsconfig (it conflicts with the "DOM" lib used by the
// rest of the app), so the global worker scope is typed loosely here.
const ctx = self as unknown as {
	postMessage(message: WorkerResponse, transfer?: Transferable[]): void;
	onmessage: ((ev: MessageEvent<WorkerRequest>) => void) | null;
};

const loader = new OBJLoader();

ctx.onmessage = async (ev) => {
	const { id, url } = ev.data;
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
		const text = await res.text();
		const group = loader.parse(text);

		const meshes: MeshPayload[] = [];
		const transfer: Transferable[] = [];
		group.traverse((child) => {
			if (!(child instanceof THREE.Mesh)) return;
			const geometry = child.geometry as THREE.BufferGeometry;
			const position = geometry.getAttribute('position')?.array as Float32Array | undefined;
			if (!position) return;
			const normal = geometry.getAttribute('normal')?.array as Float32Array | undefined;
			const uv = geometry.getAttribute('uv')?.array as Float32Array | undefined;
			const color = geometry.getAttribute('color')?.array as Float32Array | undefined;
			const index = geometry.getIndex()?.array as Uint32Array | undefined;

			transfer.push(position.buffer);
			if (normal) transfer.push(normal.buffer);
			if (uv) transfer.push(uv.buffer);
			if (color) transfer.push(color.buffer);
			if (index) transfer.push(index.buffer);

			meshes.push({
				name: child.name,
				position,
				normal: normal ?? null,
				uv: uv ?? null,
				color: color ?? null,
				index: index ?? null,
			});
		});

		ctx.postMessage({ id, ok: true, meshes }, transfer);
	} catch (err) {
		ctx.postMessage({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
	}
};
