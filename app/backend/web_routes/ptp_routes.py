from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from workcell_support import write_ptp_path_profile


def register_ptp_routes(app, get_service, error_response, read_json_request):
    """Register point-to-point trajectory API routes."""

    @app.get('/api/ptp-trajectories')
    async def list_ptp_trajectories():
        service, target = get_service()
        try:
            names = await run_in_threadpool(service.list_ptp_paths)
            return JSONResponse({"trajectoryNames": names})
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/ptp-trajectories/{name}')
    async def get_ptp_trajectory(name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.get_ptp_path, name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.delete('/api/ptp-trajectories/{name}')
    async def delete_ptp_trajectory(name: str):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.delete_ptp_path, name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/ptp-trajectories')
    async def create_ptp_trajectory(request: Request):
        """Plan a PTP path from an ordered list of target names.

        Expected body:
          name         (str)       – unique name for the planned path
          systemName   (str)       – system that will execute the path
          workcellName (str)       – active workcell name (for file storage)
          targetNames  (list[str]) – ordered target names to use as waypoints
          velocity     (float)     – optional end-effector velocity in m/s
          acceleration (float)     – optional end-effector acceleration in m/s²
          collisionMargin (float)  – optional minimum clearance distance in m
        """
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        path_name = (payload.get('name') or '').strip()
        system_name = (payload.get('systemName') or '').strip()
        workcell_name = (payload.get('workcellName') or '').strip()
        target_names = payload.get('targetNames') or []
        velocity = payload.get('velocity')
        acceleration = payload.get('acceleration')
        collision_margin = payload.get('collisionMargin')

        if not path_name or not system_name:
            return error_response(
                'Missing required fields: name, systemName.',
                400,
            )
        if not isinstance(target_names, list) or len(target_names) < 2:
            return error_response(
                'targetNames must be a list with at least 2 entries.',
                400,
            )

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.plan_ptp_path,
                path_name,
                system_name,
                target_names,
                float(collision_margin) if collision_margin is not None else None,
            )
        except Exception as error:
            return error_response(str(error), target=target)

        if workcell_name and velocity is not None and acceleration is not None:
            try:
                write_ptp_path_profile(
                    workcell_name, path_name,
                    float(velocity), float(acceleration),
                )
            except Exception as e:
                print(f"Warning: failed to write PTP motion profile for '{path_name}': {e}")

        return JSONResponse(result, status_code=201)
