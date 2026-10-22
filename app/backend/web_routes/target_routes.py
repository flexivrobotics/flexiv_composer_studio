from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse


def register_target_routes(app, get_service, error_response, read_json_request):
    """Register target-related API routes (CRUD for saved robot targets
    backed by Nebula system-pose / TargetWaypoint objects)."""

    # ------------------------------------------------------------------
    # Routes
    # ------------------------------------------------------------------

    @app.post('/api/targets')
    async def create_target(request: Request):
        """Save a new target (joint angles, cartesian pose) as a Nebula
        system-pose object."""
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        target_name = (payload.get('name') or '').strip()
        system_name = (payload.get('systemName') or '').strip()

        if not target_name or not system_name:
            return error_response(
                'Missing required fields: name, systemName.',
                400,
            )

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.save_system_pose,
                target_name,
                system_name,
                payload.get('jointAngles'),
                payload.get('cartesianPose'),
                payload.get('poseInParent'),
                payload.get('tcpName'),
            )
            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/targets/{workcell_name}')
    async def list_targets(workcell_name: str):
        """List all saved target names from Nebula.

        The *workcell_name* path parameter is kept for API compatibility;
        system-pose objects are global and not scoped to a workcell.
        """
        del workcell_name  # unused – kept for route compatibility
        service, target = get_service()
        try:
            names = await run_in_threadpool(service.list_system_poses)
            return JSONResponse({'targetNames': names})
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/targets/{workcell_name}/{target_name}')
    async def get_target(workcell_name: str, target_name: str):
        """Retrieve a single target's data from Nebula.

        The *workcell_name* path parameter is kept for API compatibility.
        """
        del workcell_name  # unused – kept for route compatibility
        service, target = get_service()
        try:
            data = await run_in_threadpool(service.get_system_pose, target_name)
            return JSONResponse(data)
        except Exception as error:
            return error_response(
                str(error),
                target=target,
                name=target_name,
            )

    @app.delete('/api/targets/{workcell_name}/{target_name}')
    async def delete_target(workcell_name: str, target_name: str):
        """Delete a system-pose (target) from Nebula.

        The *workcell_name* path parameter is kept for API compatibility.
        """
        del workcell_name  # unused – kept for route compatibility
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_system_pose, target_name)
            return JSONResponse({'deleted': target_name})
        except Exception as error:
            return error_response(
                str(error),
                target=target,
                name=target_name,
            )
