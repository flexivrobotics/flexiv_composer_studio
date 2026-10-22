// ── useSceneEvents ────────────────────────────────────────────────────
// WebSocket client for the backend's live scene-event stream
// (/api/scene-events/ws). The backend forwards each SDK SceneEvent as JSON;
// this composable parses it and hands it to an onEvent dispatcher, auto-
// reconnecting if the socket drops.

export interface SceneEventMessage {
	change: string;   // CHANGE_ADDED | CHANGE_UPDATED | CHANGE_REMOVED | CHANGE_RENAMED | CHANGE_REFRESHED | ...
	origin: string;   // ORIGIN_CONFIG | ORIGIN_FRAME | ...
	frames: string[];
	new_name: string;
	entity: { type: string; name: string } | null; // set only for ORIGIN_CONFIG
}

export function useSceneEvents(onEvent: (evt: SceneEventMessage) => void) {
	let ws: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let closedByUs = false;

	function connect(): void {
		closedByUs = false;
		if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
			return;
		}
		const proto = location.protocol === 'https:' ? 'wss' : 'ws';
		const socket = new WebSocket(`${proto}://${location.host}/api/scene-events/ws`);
		ws = socket;

		socket.onmessage = (event: MessageEvent) => {
			try {
				onEvent(JSON.parse(event.data as string) as SceneEventMessage);
			} catch (err) {
				console.error('Failed to parse scene event:', err);
			}
		};

		socket.onclose = () => {
			if (ws === socket) ws = null;
			if (!closedByUs) scheduleReconnect();
		};

		socket.onerror = () => {
			// Let onclose drive the reconnect.
			socket.close();
		};
	}

	function scheduleReconnect(): void {
		if (reconnectTimer || closedByUs) return;
		reconnectTimer = setTimeout(() => {
			reconnectTimer = null;
			if (!closedByUs) connect();
		}, 2000);
	}

	function disconnect(): void {
		closedByUs = true;
		if (reconnectTimer) {
			clearTimeout(reconnectTimer);
			reconnectTimer = null;
		}
		ws?.close();
		ws = null;
	}

	return { connect, disconnect };
}
