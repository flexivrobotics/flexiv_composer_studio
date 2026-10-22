// ── Centralised Frontend Types ────────────────────────────────────────
// All shared TypeScript interfaces, type aliases and enums used across
// the frontend live here.  Import from this file instead of defining
// types locally in components / services / composables.

// ── Object & Category Identifiers ─────────────────────────────────────

/** Top-level types used by the SceneTree panel and viewer. */
export type ObjectType = 'system' | 'scene-object' | 'camera' | 'area' | 'path' | 'target';

/** Sub-item type for child objects (paths, areas, targets, trajectories). */
export type ChildType = 'path' | 'area' | 'target' | 'ptp-trajectory' | 'linear-trajectory';

/** Categories that can appear as sub-nodes under a parent object in the tree. */
export type ChildCategory = 'area' | 'path' | 'target' | 'ptp-trajectory' | 'linear-trajectory';

/** Visual type classification for scene objects. */
export type VisualType = 'primitive' | 'mesh';

/** TCP transform gizmo mode — translate or rotate in world/local space. */
export type TcpMode = 'translate' | 'rotate-world' | 'rotate-tcp';

// ── Scene-Tree Data Structures ────────────────────────────────────────

/** A top-level item in the SceneTree panel. */
export interface TreeItem {
	name: string;
	type: ObjectType;
	children?: TreeChildItem[];
}

/** A child item nested under a TreeItem (e.g. a path under a scene-object). */
export interface TreeChildItem {
	name: string;
	type: ChildType;
	category: ChildCategory;
	parentName: string;
}

// ── Scene Viewer ──────────────────────────────────────────────────────

/** Result of a scene click intersection (raycast hit). */
export interface SceneClickHit {
	/** Name of the object that was clicked (the group name passed to addGroup). */
	name: string;
	/** World-space intersection point. */
	point: { x: number; y: number; z: number };
	/** World-space surface normal at the hit point. */
	normal: { x: number; y: number; z: number };
}

/** Callback invoked when the user clicks on a scene object. */
export type ObjectClickCallback = (hit: SceneClickHit, event?: PointerEvent) => void;

// ── Selection Composable State ────────────────────────────────────────

/** Shared reactive state tracked by the `useSelection` composable. */
export interface SelectionState {
	item: { type: ObjectType; data: any } | null;
	jointNames: string[] | null;
	/** Names of the selected system's prismatic (linear) joints. */
	prismaticJointNames: string[] | null;
	tcpLinkNames: string[] | null;
	loading: boolean;
}

// ── Scene Tree Operations Interface ──────────────────────────────────

/** Narrow interface accepted by useSceneController to add/remove items from
 *  the scene tree without depending on the SceneTree Vue component type. */
export interface ISceneTreeOps {
	addItem(name: string, type: ObjectType): void;
	addPath(parentName: string, pathName: string): void;
	addArea(parentName: string, areaName: string): void;
	addTarget(parentName: string, targetName: string): void;
	addPtpTrajectory(parentName: string, trajectoryName: string): void;
	addLinearTrajectory(parentName: string, trajectoryName: string): void;
	clearAll(): void;
	removeItemByName(name: string): void;
	/** Remove a tree item WITHOUT the confirm dialog or backend DELETE. Used to
	 *  apply a server-originated REMOVED scene event without echoing it back. */
	removeItemByNameSilent(name: string): void;
	/** True if a top-level item with this name already exists (any type). Used to
	 *  make live "ADDED" scene events idempotent (skip objects we already show). */
	hasItem(name: string): boolean;
}

// ── Workcell Composable State ─────────────────────────────────────────

/** Shared reactive state tracked by the `useWorkcell` composable. */
export interface WorkcellState {
	name: string;
	active: boolean;
	sceneObjectTypes: Map<string, VisualType>;
	/** Names of systems currently connected to hardware. */
	connectedSystems: string[];
}
