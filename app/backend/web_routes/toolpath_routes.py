from fastapi import Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from typing import Optional


def register_toolpath_routes(app, get_service, error_response, read_json_request):
    """Register toolpath-related API routes."""

    @app.get('/api/workcells/{workcell_name}/linear-trajectories/{trajectory_name}')
    async def get_linear_trajectory(workcell_name: str, trajectory_name: str):
        """Return full data for a single linear trajectory, read live from Nebula's surface path."""
        service, target = get_service()
        try:
            data = await run_in_threadpool(service.get_linear_path_trajectory, trajectory_name)
            return JSONResponse(data)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.delete('/api/workcells/{workcell_name}/linear-trajectories/{trajectory_name}')
    async def delete_linear_trajectory(workcell_name: str, trajectory_name: str):
        """Delete a saved linear trajectory: its surface path in Nebula."""
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_linear_path_trajectory, trajectory_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/workcells/{workcell_name}/linear-trajectories')
    async def list_linear_trajectories_route(workcell_name: str):
        """List all saved linear path trajectories (read live from Nebula)."""
        service, target = get_service()
        try:
            trajectories = await run_in_threadpool(service.list_linear_path_trajectories)
            return JSONResponse({'trajectories': trajectories})
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/surface-paths')
    async def list_surface_paths():
        """List every surface path name in Nebula — toolpaths and linear
        trajectories alike — e.g. to check a new name doesn't collide with
        either kind before creating one."""
        service, target = get_service()
        try:
            names = await run_in_threadpool(service.list_all_surface_path_names)
            return JSONResponse({'names': names})
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/trajectories')
    async def create_linear_trajectory(request: Request):
        """Create a linear path trajectory by solving a selected surface path.

        Expected body:
          name         (str) – unique name for the trajectory (used as filename)
          systemName   (str) – system to solve for
          workcellName (str) – active workcell (determines save folder)
          pathName     (str) – surface path to duplicate and solve
        """
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)
        
        print("Payload received for creating linear trajectory:", payload)

        trajectory_name = (payload.get('name') or '').strip()
        system_name = (payload.get('systemName') or '').strip()
        workcell_name = (payload.get('workcellName') or '').strip()
        path_name = (payload.get('pathName') or '').strip()
        tcp_name = (payload.get('tcpName') or '').strip()
        normal_offset = float(payload.get('normalOffset') or 0.0)
        elbow_swivel_angle = float(payload.get('elbowSwivelAngle') or 0.0)
        external_axis_position = payload.get('externalAxisPosition') or None
        external_axis_preset = bool(payload.get('externalAxisPositionPreset', True))
        force = payload.get('force') or {}
        moment = payload.get('moment') or {}
        velocity = float(payload.get('velocity') or 0.1)
        acceleration = float(payload.get('acceleration') or 0.5)

        if not trajectory_name or not system_name:
            return error_response('Missing required fields: name, systemName.', 400)
        if not path_name:
            return error_response('Missing required field: pathName.', 400)
        if not workcell_name:
            return error_response('Missing required field: workcellName.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.create_linear_path_trajectory,
                path_name,
                system_name,
                workcell_name,
                trajectory_name,
                tcp_name,
                normal_offset,
                elbow_swivel_angle,
                external_axis_position,
                external_axis_preset,
                force,
                moment,
                velocity,
                acceleration,
            )
            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/path/generate-between-points')
    async def generate_path_between_points(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        parent = payload.get('parentObjectName', '').strip()
        from_pt = payload.get('from')
        to_pt = payload.get('to')
        fixed_spacing = payload.get('fixedSpacing', 0.01)

        if not parent or not from_pt or not to_pt:
            return error_response(
                'Missing required fields: parentObjectName, from, to.',
                400,
            )

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.generate_toolpath_between_points,
                parent,
                [from_pt['x'], from_pt['y'], from_pt['z']],
                [to_pt['x'], to_pt['y'], to_pt['z']],
                fixed_spacing,
            )
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/path/generate-from-points')
    async def generate_path_from_points(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        parent = payload.get('parentObjectName', '').strip()
        path_name_ref = payload.get('pathNameRef', 'toolpath')
        points = payload.get('points', [])
        blending_radius = payload.get('blendingRadius', 0.0)
        fixed_spacing = payload.get('fixedSpacing', 0.01)
        workcell_name = (payload.get('workcellName') or '').strip()
        flag_auto_name = payload.get('flagAutoName', True)
        orientation_alignment_type = payload.get('orientationAlignmentType', 'initial_direction')
        orientation_alignment_direction = payload.get('orientationAlignmentDirection', {'x': 1.0, 'y': 0.0, 'z': 0.0})

        if not parent or not points or len(points) < 2:
            return error_response(
                'Missing required fields: parentObjectName, points (min 2).',
                400,
            )

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.generate_toolpath_from_points,
                parent,
                path_name_ref,
                points,
                blending_radius,
                fixed_spacing,
                workcell_name,
                flag_auto_name,
                orientation_alignment_type,
                orientation_alignment_direction,
            )
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.post('/api/path/generate-raster')
    async def generate_raster_path(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        parent = payload.get('parentObjectName', '').strip()
        active_workcell_name = (payload.get('activeWorkcellName') or '').strip()
        path_name_ref = payload.get('pathNameRef', 'raster_path')
        fixed_spacing = payload.get('fixedSpacing', 0.01)
        blending_radius = payload.get('blendingRadius', 0.0)
        border_offset = payload.get('borderOffset', 0.0)
        raster_line_spacing = payload.get('rasterLineSpacing', 0.05)
        raster_joining_threshold = payload.get('rasterJoiningThreshold', 0.01)
        direction_type = payload.get('directionType', 'principal')
        principal_rotation_angle = payload.get('principalRotationAngle', 0.0)
        specified_direction = payload.get('specifiedDirection', {'x': 1.0, 'y': 0.0, 'z': 0.0})
        workcell_name = (payload.get('workcellName') or '').strip()
        orientation_alignment_type = payload.get('orientationAlignmentType', 'initial_direction')
        orientation_alignment_direction = payload.get('orientationAlignmentDirection', {'x': 1.0, 'y': 0.0, 'z': 0.0})

        if not parent:
            return error_response('Missing required field: parentObjectName.', 400)
        if not active_workcell_name:
            return error_response('Missing required field: activeWorkcellName.', 400)

        service, target = get_service()
        try:
            from workcell_support import (
                read_area_json,
                get_areas_assets_folder,
                convert_local_path_to_server_path,
            )

            area_data = await run_in_threadpool(read_area_json, active_workcell_name, parent)

            generate_target = parent
            save_as_parent = None
            temp_object_name = None

            if area_data:
                real_parent_name = area_data.get('parentName', '')
                mesh_path = get_areas_assets_folder(active_workcell_name) / f'{parent}.obj'
                if not mesh_path.is_file():
                    return error_response(f"Area mesh file not found for '{parent}'.", 404)
                nebula_mesh_path = str(convert_local_path_to_server_path(mesh_path))

                parent_pose = await run_in_threadpool(service.get_scene_object_pose, real_parent_name)
                temp_object_name = f'__toolpath_temp_{parent}'
                await run_in_threadpool(
                    service.add_scene_object_mesh, temp_object_name, nebula_mesh_path,
                    parent_pose.get('position'), parent_pose.get('quaternion'),
                )
                generate_target = temp_object_name
                save_as_parent = real_parent_name

            try:
                result = await run_in_threadpool(
                    service.generate_raster_toolpath,
                    generate_target,
                    path_name_ref,
                    fixed_spacing,
                    blending_radius,
                    border_offset,
                    raster_line_spacing,
                    raster_joining_threshold,
                    direction_type,
                    principal_rotation_angle,
                    specified_direction,
                    workcell_name,
                    orientation_alignment_type,
                    orientation_alignment_direction,
                    save_as_parent,
                )
            finally:
                if temp_object_name:
                    try:
                        await run_in_threadpool(service.remove_scene_object, temp_object_name)
                    except Exception as cleanup_error:
                        print(f"Warning: failed to remove temp toolpath object '{temp_object_name}': {cleanup_error}")

            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, object=parent)

    @app.put('/api/path/{path_name}/waypoints')
    async def update_toolpath_waypoints(path_name: str, request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        cartesian_waypoints = payload.get('CartesianWaypoints', [])
        if not cartesian_waypoints:
            return error_response('Missing required field: CartesianWaypoints.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.update_toolpath_waypoints,
                path_name,
                cartesian_waypoints,
            )
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target)

    @app.delete('/api/path/{path_name}')
    async def delete_toolpath(path_name: str, workcellName: Optional[str] = None):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.remove_toolpath, path_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, path=path_name)

    @app.get('/api/paths')
    async def list_toolpaths(workcellName: Optional[str] = None):
        service, target = get_service()
        try:
            names = await run_in_threadpool(service.list_toolpaths)
            return JSONResponse({'pathNames': names})
        except Exception as error:
            return error_response(str(error), target=target)

    @app.get('/api/paths/{path_name}')
    async def get_toolpath(path_name: str, workcellName: Optional[str] = None):
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.get_toolpath, path_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, path=path_name)
