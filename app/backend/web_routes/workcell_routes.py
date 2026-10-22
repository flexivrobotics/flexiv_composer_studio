from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse

from robot_connection import connections


def register_workcell_routes(app, get_service, error_response, read_json_request):
    """Register workcell-related API routes."""

    @app.get('/api/workcells')
    def list_workcells():
        service, target = get_service()
        try:
            return JSONResponse(service.list_workcells())
        except Exception as error:
            return error_response(str(error), target=target, workcells=[])

    @app.post('/api/workcells/load')
    async def load_workcell(request: Request):
        print("[POST /api/workcells/load] request received (workcell selected)", flush=True)
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            print(f"[POST /api/workcells/load] bad JSON body: {error}", flush=True)
            return error_response(str(error), 400)

        name = payload.get('name', '').strip()
        if not name:
            print("[POST /api/workcells/load] missing workcell name", flush=True)
            return error_response('Missing workcell name.', 400)

        service, target = get_service()
        try:
            # The editor forgets its connected systems on every load, so close
            # their robot connections too rather than leave them unreachable.
            disconnected = await run_in_threadpool(connections.disconnect_all)
            if disconnected:
                print(f"[POST /api/workcells/load] disconnected robots of {disconnected}", flush=True)

            result = await run_in_threadpool(service.load_workcell, name)

            if 'systems' in result:
                print(f"Loaded workcell '{name}' with {len(result['systems'])} systems", flush=True)

            return JSONResponse(result)
        except Exception as error:
            print(f"[POST /api/workcells/load] load_workcell FAILED: {error!r}", flush=True)
            return error_response(str(error), target=target, workcell=name)

    @app.post('/api/workcells')
    async def create_workcell(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        name = payload.get('name', '').strip()
        description = payload.get('description', '').strip()

        if not name:
            return error_response('Missing workcell name.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(service.create_workcell, name, description)
            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target, workcell=name)

    @app.delete('/api/workcells/{workcell_name}')
    async def delete_workcell(workcell_name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.delete_workcell, workcell_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, workcell=workcell_name)
