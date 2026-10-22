from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse


def register_collision_routes(app, get_service, error_response, read_json_request):
    """Register collision configuration API routes."""

    @app.get('/api/collision-configs')
    async def list_collision_configs():
        service, target = get_service()
        try:
            names = await run_in_threadpool(service.list_collision_configs)
            return JSONResponse({"configs": names})
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/collision-configs')
    async def create_collision_config(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        name = (payload.get('name') or '').strip()
        if not name:
            return error_response('Missing required field: name.', 400)
        collision_margin = float(payload.get('collisionMargin') or 0.0)

        service, target = get_service()
        try:
            result = await run_in_threadpool(service.create_collision_config, name, collision_margin)
            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/collision-configs/{config_name}')
    async def get_collision_config(config_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.get_collision_config, config_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.put('/api/collision-configs/{config_name}')
    async def update_collision_config(config_name: str, request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        collision_margin = float(payload.get('collisionMargin') or 0.0)

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.update_collision_config_margin, config_name, collision_margin
            )
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.put('/api/collision-configs/{config_name}/rename')
    async def rename_collision_config(config_name: str, request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        new_name = (payload.get('newName') or '').strip()
        if not new_name:
            return error_response('Missing required field: newName.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(service.rename_collision_config, config_name, new_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.delete('/api/collision-configs/{config_name}')
    async def delete_collision_config(config_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_collision_config, config_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/collision-configs/{config_name}/pairs')
    async def add_collision_pair(config_name: str, request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        name1 = (payload.get('name1') or '').strip()
        name2 = (payload.get('name2') or '').strip()
        if not name1 or not name2:
            return error_response('Missing required fields: name1, name2.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(service.add_collision_pair, config_name, name1, name2)
            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.delete('/api/collision-configs/{config_name}/pairs')
    async def remove_collision_pair(config_name: str, name1: str, name2: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_collision_pair, config_name, name1, name2)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/collision-components')
    async def list_collision_components():
        service, target = get_service()
        try:
            names = await run_in_threadpool(service.list_collision_components)
            return JSONResponse({"components": names})
        except Exception as error:
            return error_response(str(error), target=target)
