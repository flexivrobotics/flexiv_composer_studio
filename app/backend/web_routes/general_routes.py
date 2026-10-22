from pathlib import Path
from urllib.parse import unquote

from fastapi.responses import FileResponse, Response


def register_general_routes(app, error_response):
    """Register generic utility API routes."""

    @app.get('/api/file')
    def get_file(path: str = ''):
        if not path:
            return error_response('Missing path parameter.', 400)
        fpath = Path(unquote(path))
        if not fpath.is_file():
            return error_response(f'File not found: {fpath}', 404)
        return FileResponse(fpath)

    @app.get('/favicon.ico')
    def favicon():
        return Response(status_code=204)
