// ── Typed API Client ─────────────────────────────────────────────────
// Centralises all HTTP communication with the backend.  All callers should
// import `apiGet`, `apiPost`, `apiDelete` (and `apiPostForm` for file uploads)
// instead of calling `fetch` directly.

export class ApiError extends Error {
	constructor(public readonly status: number, message: string) {
		super(message);
		this.name = 'ApiError';
	}
}

async function parseResponse<T>(res: Response): Promise<T> {
	const contentType = res.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) {
		const text = await res.text();
		if (!res.ok) throw new ApiError(res.status, text || `HTTP ${res.status}`);
		return undefined as T;
	}

	const data = await res.json();
	if (!res.ok) {
		throw new ApiError(res.status, data?.error ?? `HTTP ${res.status}`);
	}
	if (data?.error) {
		throw new ApiError(res.status, data.error as string);
	}
	return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
	const res = await fetch(path);
	return parseResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(path, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return parseResponse<T>(res);
}

export async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
	const res = await fetch(path, { method: 'POST', body: formData });
	return parseResponse<T>(res);
}

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(path, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return parseResponse<T>(res);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
	const res = await fetch(path, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
	return parseResponse<T>(res);
}

export async function apiDelete<T = unknown>(
	path: string,
	options?: { signal?: AbortSignal },
): Promise<T> {
	const res = await fetch(path, { method: 'DELETE', signal: options?.signal });
	return parseResponse<T>(res);
}
