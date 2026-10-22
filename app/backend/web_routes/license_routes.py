from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse


def register_license_routes(app, get_service, error_response, read_json_request):
    """Register license listing / device-identifier / install API routes."""

    @app.get('/api/license')
    async def list_license_status():
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.list_licenses)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/license/device-identifier')
    async def get_device_identifier():
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.get_device_identifier)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/license')
    async def install_license(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        # Base64 of the chosen license file's raw bytes, not the final
        # SaveRequest.license value - service.save_license derives that via
        # the SDK's license_file helper, same as the CLI does.
        license_b64 = (payload.get('license') or '').strip()
        file_name = (payload.get('fileName') or '').strip()

        if not license_b64:
            return error_response('Missing required field: license.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(service.save_license, license_b64, file_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)
