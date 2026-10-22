from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

# Always-required fields for creating/modifying a camera (mirrors camera.proto's
# [required] markers on far_width, far_height, far_distance, near_distance,
# depth_scale, and camera_id, plus ConfigHeader.name). See the SetupCamera.vue
# REQUIRED_FIELDS list, which must stay in sync with this set.
CAMERA_REQUIRED_FIELDS = (
    'name', 'cameraId', 'farWidth', 'farHeight', 'farDistance', 'nearDistance', 'depthScale',
)


def register_camera_routes(app, get_service, error_response, read_json_request):
    """Register scene camera API routes."""

    @app.get('/api/cameras')
    def list_cameras():
        service, target = get_service()
        try:
            return JSONResponse(service.list_cameras())
        except Exception as error:
            return error_response(str(error), target=target, cameras=[])

    @app.post('/api/cameras')
    async def create_camera(request: Request):

        print("Received request to create camera")
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        missing = [f for f in CAMERA_REQUIRED_FIELDS if payload.get(f) in (None, '')]
        if missing:
            return error_response(
                f'Missing required field(s): {", ".join(missing)}.', 400,
            )

        name = payload['name'].strip()
        parent = (payload.get('parent') or 'world').strip() or 'world'
        position = payload.get('position') or [0.0, 0.0, 0.0]
        quaternion = payload.get('quaternion') or [0.0, 0.0, 0.0, 1.0]

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.create_camera,
                name,
                parent,
                position,
                quaternion,
                int(payload['cameraId']),
                float(payload['farWidth']),
                float(payload['farHeight']),
                float(payload['farDistance']),
                float(payload['nearDistance']),
                float(payload['depthScale']),
            )
            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target, camera=name)

    @app.get('/api/cameras/{camera_name}/config')
    def get_camera_config(camera_name: str):
        service, target = get_service()
        try:
            return JSONResponse(service.get_camera_config(camera_name))
        except Exception as error:
            return error_response(str(error), target=target, camera=camera_name)

    @app.get('/api/cameras/{camera_name}/device-resolution')
    async def get_camera_device_resolution(camera_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.get_camera_device_resolution, camera_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, camera=camera_name)

    @app.delete('/api/cameras/{camera_name}')
    async def remove_camera(camera_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_camera, camera_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, camera=camera_name)
