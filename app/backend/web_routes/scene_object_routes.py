from pathlib import Path
from urllib.parse import quote

from fastapi import File, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse


def register_scene_object_routes(
    app,
    get_service,
    error_response,
    read_json_request,
    convert_local_path_to_server_path,
):
    """Register scene object and asset API routes."""

    @app.post('/api/scene-objects/mesh')
    async def add_scene_object_mesh(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        name = payload.get('name', '').strip()
        mesh_path = payload.get('meshFilePath', '').strip()
        parent = (payload.get('parent') or 'world').strip() or 'world'

        if not name or not mesh_path:
            return error_response('Missing required fields: name or meshFilePath.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.add_scene_object_mesh, name, mesh_path, None, None, parent)
            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target, object=name)

    @app.post('/api/scene-objects/box')
    async def add_scene_object_box(request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        name = payload.get('name', '').strip()
        size_x = payload.get('sizeX')
        size_y = payload.get('sizeY')
        size_z = payload.get('sizeZ')
        position = payload.get('position')
        quaternion = payload.get('quaternion')
        parent = (payload.get('parent') or 'world').strip() or 'world'

        if not name or size_x is None or size_y is None or size_z is None:
            return error_response('Missing required fields: name, sizeX, sizeY, or sizeZ.', 400)
        if (position is not None and len(position) != 3) or (quaternion is not None and len(quaternion) != 4):
            return error_response('position must have 3 values and quaternion 4 (x, y, z, w).', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.add_scene_object_box, name, float(size_x), float(size_y), float(size_z),
                position, quaternion, parent)
            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target, object=name)

    # Always-required fields for a pose write (mirrors ConfigHeader.pose_in_parent
    # [required] and the SetupSceneObject.vue pose form).
    POSE_REQUIRED_FIELDS = ('position', 'quaternion')

    @app.get('/api/scene-objects/{object_name}')
    async def get_scene_object(object_name: str):
        """Return a single object's geometry + pose (for live incremental add)."""
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.get_scene_object, object_name)
            if result.get('meshFilename'):
                from workcell_support import convert_server_path_to_local_path
                local_path = convert_server_path_to_local_path(Path(result['meshFilename']))
                result['meshUrl'] = f'/api/file?path={quote(str(local_path), safe="")}'
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, object=object_name)

    @app.get('/api/scene-objects/{object_name}/pose')
    async def get_scene_object_pose(object_name: str):
        """Return an object's current {position, quaternion}."""
        service, target = get_service()
        try:
            result = await run_in_threadpool(service.get_scene_object_pose, object_name)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, object=object_name)

    @app.patch('/api/scene-objects/{object_name}/pose')
    async def move_scene_object(object_name: str, request: Request):
        """Persist a new pose for an object (two-way edit from the object editor)."""
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        missing = [f for f in POSE_REQUIRED_FIELDS if not payload.get(f)]
        if missing:
            return error_response(
                f'Missing required field(s): {", ".join(missing)}.', 400)

        position = payload['position']
        quaternion = payload['quaternion']
        if len(position) != 3 or len(quaternion) != 4:
            return error_response(
                'position must have 3 values and quaternion 4 (x, y, z, w).', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.move_scene_object, object_name, position, quaternion)
            return JSONResponse(result)
        except Exception as error:
            return error_response(str(error), target=target, object=object_name)

    @app.post('/api/scene-objects/{object_name}/filter-mesh')
    async def filter_scene_object_mesh(object_name: str, request: Request):
        # ── Parse payload ──────────────────────────────────────────
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        filter_type = payload.get('filterType', '').strip()
        if not filter_type:
            return error_response('Missing required field: filterType.', 400)

        pass_band = float(payload.get('passBand', 0.1))
        num_iterations = int(payload.get('numIterations', 10))
        replace_object = bool(payload.get('replaceObject', True))
        workcell_name = payload.get('workcellName', '').strip()

        if not workcell_name:
            return error_response('Missing required field: workcellName.', 400)

        bbox_center = payload.get('bboxCenter')
        bbox_orientation = payload.get('bboxOrientation')
        bbox_extents = payload.get('bboxExtents')
        enable_z_bound = bool(payload.get('enableZBound', True))

        service, target = get_service()
        try:
            import shutil
            from workcell_support import (
                convert_server_path_to_local_path,
                get_generated_meshes_folder,
                get_scene_assets_folder,
            )

            # ── Capture old mesh path if replacing in-place ─────────
            old_mesh_filename = None
            if replace_object:
                old_mesh_filename = await run_in_threadpool(
                    service.get_scene_object_mesh_filename, object_name
                )

            # ── Apply the mesh filter on the nebula server ──────────
            result = await run_in_threadpool(
                service.filter_scene_object_mesh,
                object_name,
                filter_type,
                pass_band=pass_band,
                num_iterations=num_iterations,
                replace_object=replace_object,
                bbox_center=bbox_center,
                bbox_orientation=bbox_orientation,
                bbox_extents=bbox_extents,
                enable_z_bound=enable_z_bound,
            )

            if replace_object:
                # ── Delete the original mesh files first ────────────
                if old_mesh_filename:
                    old_local = convert_server_path_to_local_path(Path(old_mesh_filename))
                    for file in old_local.parent.glob(f"{old_local.stem}.*"):
                        try:
                            file.unlink()
                            print(f"Deleted old mesh file: {file}")
                        except Exception as error:
                            print(f"Error deleting old mesh file {file}: {error}")

                # ── Move the filtered mesh from generated_meshes into scene/assets ──
                generated_folder = get_generated_meshes_folder(workcell_name)
                generated_files = list(generated_folder.glob(f'{object_name}.*'))
                if generated_files:
                    assets_folder = get_scene_assets_folder(workcell_name)
                    assets_folder.mkdir(parents=True, exist_ok=True)
                    for src_file in generated_files:
                        dst_file = assets_folder / src_file.name
                        shutil.move(str(src_file), str(dst_file))
                    new_local = assets_folder / f'{object_name}.obj'
                    result['meshUrl'] = f'/api/file?path={quote(str(new_local), safe="")}'

                    # ── Re-save the object so the nebula server's registered
                    # mesh path matches the new scene/assets location ──────
                    new_server_path = str(convert_local_path_to_server_path(new_local))
                    current = await run_in_threadpool(service.get_scene_object, object_name)
                    await run_in_threadpool(
                        service.add_scene_object_mesh,
                        object_name,
                        new_server_path,
                        current['pose']['position'],
                        current['pose']['quaternion'],
                        current['parent'],
                    )

            # When not replacing, copy each filtered mesh out of generated_meshes
            # into scene/assets and add it to the scene as a new object.
            if not replace_object:
                filtered_names = result.get('filtered_objects') or []
                generated_folder = get_generated_meshes_folder(workcell_name)
                assets_folder = get_scene_assets_folder(workcell_name)

                current = await run_in_threadpool(service.get_scene_object, object_name)
                parent = current['parent']
                position = current['pose']['position']
                quaternion = current['pose']['quaternion']

                added_names = []
                filtered_mesh_urls = {}
                for filtered_name in filtered_names:
                    generated_files = list(generated_folder.glob(f'{filtered_name}.*'))
                    if not generated_files:
                        continue

                    assets_folder.mkdir(parents=True, exist_ok=True)
                    for src_file in generated_files:
                        dst_file = assets_folder / src_file.name
                        shutil.move(str(src_file), str(dst_file))

                    obj_file = next(
                        (f for f in generated_files if f.suffix == '.obj'), generated_files[0]
                    )
                    new_name = obj_file.stem
                    new_local = assets_folder / f'{new_name}.obj'
                    new_server_path = str(convert_local_path_to_server_path(new_local))

                    await run_in_threadpool(
                        service.add_scene_object_mesh,
                        new_name,
                        new_server_path,
                        position,
                        quaternion,
                        parent,
                    )

                    added_names.append(new_name)
                    filtered_mesh_urls[new_name] = f'/api/file?path={quote(str(new_local), safe="")}'

                result['filtered_objects'] = added_names
                result['filteredMeshUrls'] = filtered_mesh_urls

                # Back-compat single-object fields for the frontend widget.
                if len(added_names) == 1:
                    result['filtered_object'] = added_names[0]
                    result['filteredMeshUrl'] = filtered_mesh_urls.get(added_names[0])

            return JSONResponse(result, status_code=200)
        except Exception as error:
            return error_response(
                str(error),
                target=target,
                object=object_name,
            )

    @app.post('/api/scene-objects/{object_name}/extract-area')
    async def extract_area_from_scene_object(object_name: str, request: Request):
        try:
            payload = await read_json_request(request)
        except ValueError as error:
            return error_response(str(error), 400)

        area_name = payload.get('areaName', '').strip()
        boundary = payload.get('boundary', [])
        workcell_name = payload.get('workcellName', '').strip()

        if not area_name:
            return error_response('Missing required field: areaName.', 400)
        if not boundary:
            return error_response('Missing required field: boundary.', 400)
        if not workcell_name:
            return error_response('Missing required field: workcellName.', 400)

        service, target = get_service()
        try:
            result = await run_in_threadpool(
                service.extract_area_mesh, object_name, area_name, boundary
            )

            extracted_name = result.get('extracted_object')
            if extracted_name:
                import shutil
                from workcell_support import get_areas_assets_folder, get_filesystem_root, write_area_json

                # The server writes the extracted mesh directly to a file
                # under the workcell's generated_mesh folder (it is no
                # longer registered as a scene object we could look up via
                # ConfigService).
                generated_folder = get_filesystem_root() / 'workcell' / workcell_name / 'generated_meshes'
                generated_files = list(generated_folder.glob(f'{extracted_name}.*'))

                print("Generated folder: ", generated_folder)

                if generated_files:
                    assets_folder = get_areas_assets_folder(workcell_name)
                    assets_folder.mkdir(parents=True, exist_ok=True)
                    # Move all files sharing the same stem (e.g. .obj + .mtl).
                    for src_file in generated_files:
                        dst_file = assets_folder / src_file.name
                        shutil.move(str(src_file), str(dst_file))
                    new_local = assets_folder / f'{extracted_name}.obj'
                    result['meshUrl'] = f'/api/file?path={quote(str(new_local), safe="")}'
                    write_area_json(workcell_name, extracted_name, object_name)

            return JSONResponse(result, status_code=201)
        except Exception as error:
            return error_response(str(error), target=target, object=object_name)

    @app.get('/api/{workcell_name}/areas')
    async def list_areas_route(workcell_name: str):
        """List all areas recorded for a workcell, with their parent and mesh URL."""
        from workcell_support import get_areas_assets_folder, list_areas
        try:
            area_registry = await run_in_threadpool(list_areas, workcell_name)
            assets_folder = get_areas_assets_folder(workcell_name)
            areas = []
            for area_name, parent_name in area_registry.items():
                mesh_path = assets_folder / f'{area_name}.obj'
                mesh_url = (
                    f'/api/file?path={quote(str(mesh_path), safe="")}'
                    if mesh_path.is_file() else None
                )
                areas.append({'name': area_name, 'parentName': parent_name, 'meshUrl': mesh_url})
            return JSONResponse({'areas': areas})
        except Exception as error:
            return error_response(str(error), workcell=workcell_name)

    @app.delete('/api/{workcell_name}/areas/{area_name}')
    async def remove_area(workcell_name: str, area_name: str):
        try:
            from workcell_support import get_areas_assets_folder, delete_area_json

            assets_folder = get_areas_assets_folder(workcell_name)
            for file in assets_folder.glob(f'{area_name}.*'):
                try:
                    file.unlink()
                    print(f"Deleted area mesh file: {file}")
                except Exception as error:
                    print(f"Error deleting area mesh file {file}: {error}")

            delete_area_json(workcell_name, area_name)

            return JSONResponse({'message': f"Removed area '{area_name}'.", 'area': area_name})
        except Exception as error:
            return error_response(
                str(error),
                workcell=workcell_name,
                object=area_name,
            )

    @app.delete('/api/{workcell_name}/scene-objects/{object_name}')
    async def remove_scene_object(workcell_name: str, object_name: str):
        service, target = get_service()
        try:
            mesh_filename = await run_in_threadpool(
                service.get_scene_object_mesh_filename, object_name
            )

            result = await run_in_threadpool(service.remove_scene_object, object_name)

            if mesh_filename:
                from pathlib import Path
                from workcell_support import convert_server_path_to_local_path

                mesh_path = Path(convert_server_path_to_local_path(Path(mesh_filename)))
                for file in mesh_path.parent.glob(f"{mesh_path.stem}.*"):
                    try:
                        file.unlink()
                        print(f"Deleted mesh file: {file}")
                    except Exception as error:
                        print(f"Error deleting mesh file {file}: {error}")

            return JSONResponse(result)
        except Exception as error:
            return error_response(
                str(error),
                target=target,
                workcell=workcell_name,
                object=object_name,
            )

    @app.post('/api/workcells/{workcell_name}/scene/assets/{object_name}')
    async def upload_scene_assets(
        workcell_name: str,
        object_name: str,
        obj_file: UploadFile = File(...),
        mtl_file: UploadFile = File(None),
    ):
        from workcell_support import get_filesystem_root

        assets_dir = get_filesystem_root() / 'workcell' / workcell_name / 'scene' / 'assets'
        assets_dir.mkdir(parents=True, exist_ok=True)

        obj_path = assets_dir / f"{object_name}.obj"
        obj_path.write_bytes(await obj_file.read())

        mtl_path = None
        if mtl_file:
            ext = Path(mtl_file.filename).suffix or '.mtl'
            mtl_path = assets_dir / f"{object_name}{ext}"
            mtl_path.write_bytes(await mtl_file.read())

        return JSONResponse(
            {
                'objPath': str(obj_path),
                'mtlPath': str(mtl_path) if mtl_path else None,
                'objServerPath': str(convert_local_path_to_server_path(obj_path)),
                'mtlServerPath': str(convert_local_path_to_server_path(mtl_path))
                if mtl_path
                else None,
            },
            status_code=201,
        )
