from pathlib import Path

from fastapi import Request
from fastapi.responses import JSONResponse


def register_config_routes(app, error_response, read_json_request):
    """Register runtime configuration API routes (workcell root, directory browser)."""

    @app.get('/api/workcell-root')
    def get_workcell_root():
        from workcell_support import get_filesystem_root
        p = get_filesystem_root()
        return JSONResponse({'path': str(p), 'valid': p.is_dir()})

    @app.post('/api/workcell-root')
    async def post_workcell_root(request: Request):
        from workcell_support import set_workcell_root
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)
        path = payload.get('path', '').strip()
        if not path:
            return error_response('Missing path.', 400)
        p = Path(path).expanduser().resolve()
        if not p.is_dir():
            return error_response(f'Directory not found: {p}', 400)
        set_workcell_root(str(p))
        return JSONResponse({'path': str(p)})

    @app.get('/api/browse-directories')
    def browse_directories(path: str = ''):
        try:
            p = Path(path).expanduser().resolve() if path else Path.home()
            if not p.is_dir():
                return error_response(f'Not a directory: {p}', 400)
            dirs = sorted(
                d.name for d in p.iterdir()
                if d.is_dir() and not d.name.startswith('.')
            )
            parent = str(p.parent) if p != p.parent else None
            return JSONResponse({'path': str(p), 'parent': parent, 'dirs': dirs})
        except PermissionError:
            return error_response(f'Permission denied: {path}', 403)
        except Exception as exc:
            return error_response(str(exc))
