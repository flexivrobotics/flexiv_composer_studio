import mimetypes
import json
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from nebula_service import NebulaServices
from web_routes import (
    register_camera_routes,
    register_collision_routes,
    register_config_routes,
    register_general_routes,
    register_license_routes,
    register_ptp_routes,
    register_scene_event_routes,
    register_scene_object_routes,
    register_system_routes,
    register_target_routes,
    register_toolpath_routes,
    register_workcell_routes,
)
from workcell_support import (
    get_nebula_target,
    convert_local_path_to_server_path,
)

mimetypes.add_type('application/javascript', '.ts')

# ------------------------------------------------------------------------------
# Utilities
# ------------------------------------------------------------------------------

class NoCacheStaticFiles(StaticFiles):
    """Static files implementation with cache disabling."""
    def is_not_modified(self, response_headers, request_headers):
        return False

async def read_json_request(request):
    """Safely parse JSON body from request."""
    body = await request.body()
    if not body:
        return {}
    try:
        payload = json.loads(body.decode('utf-8'))
    except json.JSONDecodeError as exc:
        raise ValueError(f'Invalid JSON body: {exc.msg}') from exc
    if not isinstance(payload, dict):
        raise ValueError('Invalid JSON body: expected an object.')
    return payload

def error_response(message: str, status_code: int = 503, **kwargs):
    """Utility to create consistent error responses."""
    data = {'error': message}
    data.update(kwargs)
    return JSONResponse(data, status_code=status_code)

# ------------------------------------------------------------------------------
# App Factory
# ------------------------------------------------------------------------------

def create_app(directory):
    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    directory = Path(directory).expanduser().resolve()

    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r'https?://(localhost|127\.0\.0\.1)(:\d+)?$',
        allow_credentials=False,
        allow_methods=['*'],
        allow_headers=['*'],
    )

    @app.middleware('http')
    async def disable_cache(request: Request, call_next):
        response = await call_next(request)
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
        return response

    def get_service():
        """Helper to instantiate NebulaServices with current target."""
        target = get_nebula_target()
        return NebulaServices(target), target

    register_config_routes(app, error_response, read_json_request)
    register_collision_routes(app, get_service, error_response, read_json_request)
    register_workcell_routes(app, get_service, error_response, read_json_request)
    register_system_routes(app, get_service, error_response, read_json_request, convert_local_path_to_server_path)
    register_scene_object_routes(
        app,
        get_service,
        error_response,
        read_json_request,
        convert_local_path_to_server_path,
    )
    register_camera_routes(app, get_service, error_response, read_json_request)
    register_scene_event_routes(app, get_service, error_response)
    register_toolpath_routes(app, get_service, error_response, read_json_request)
    register_target_routes(app, get_service, error_response, read_json_request)
    register_ptp_routes(app, get_service, error_response, read_json_request)
    register_license_routes(app, get_service, error_response, read_json_request)
    register_general_routes(app, error_response)

    if directory.is_dir():
        app.mount('/', NoCacheStaticFiles(directory=directory, html=True), name='static')

    return app
