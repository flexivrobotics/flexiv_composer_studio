import json
import os
import re
from pathlib import Path
from urllib.parse import quote


DEFAULT_NEBULA_TARGET = 'localhost:50052'
DEFAULT_NEBULA_WORKCELL_ROOT = '/home/flexiv'
# A launcher/installer may drop the PDK release folder path here before the
# backend starts, so it can be used as the default workcell root.
_SDK_SERVER_PATH_FILE = Path('/tmp/flexiv_nebula_sdk_server_path.txt')


def _compute_default_workcell_root() -> str:
	# Default to the parent folder of this repo. This file
	# is at <repo>/app/backend/workcell_support.py, so parents[2] is the repo root
	# and parents[3] is its parent folder (the release workspace).
	fallback = str(Path(__file__).resolve().parents[3])

	try:
		if _SDK_SERVER_PATH_FILE.is_file():
			pdk_release_path = _SDK_SERVER_PATH_FILE.read_text().strip()
			if pdk_release_path:
				return pdk_release_path
	except OSError:
		pass

	return fallback


DEFAULT_WORKCELL_ROOT = _compute_default_workcell_root()
WORKCELL_ASSET_PREFIX = '/api/workcell-assets/'
WORKCELL_URDF_ENDPOINT = '/api/workcell-urdf'
DEFAULT_DIRECTORY = Path(__file__).resolve().parent.parent / 'frontend' / 'dist'

# Runtime-settable workcell root (overrides env var and default when set via API)
_runtime_workcell_root: str | None = None


def get_nebula_target():

	return os.environ.get('NEBULA_TARGET', DEFAULT_NEBULA_TARGET)


def get_filesystem_root():

	if _runtime_workcell_root is not None:
		return Path(_runtime_workcell_root).expanduser().resolve()
	return Path(os.environ.get('WORKCELL_ROOT', DEFAULT_WORKCELL_ROOT)).expanduser().resolve()


def set_workcell_root(path: str) -> None:
	global _runtime_workcell_root
	_runtime_workcell_root = path


def get_nebula_root():

	return Path(os.environ.get('NEBULA_ROOT', DEFAULT_NEBULA_WORKCELL_ROOT)).expanduser().resolve()

def check_system_local_urdf_path(workcell_name, system_name):

	local_root_path = get_filesystem_root()

	system_root = Path(local_root_path) / 'workcell' / workcell_name / 'systems' / system_name
	candidate = system_root / f'{system_name}_abs_path.urdf'
	
	if (candidate.exists()):
		return candidate.resolve()

	raise FileNotFoundError(f'No URDF found for system: {system_name}')

def convert_local_path_to_server_path(local_path):

	nebula_root = get_nebula_root()
	local_root = get_filesystem_root()

	# Swap local root with nebula root to get the corresponding path in Nebula's filesystem
	relative_path = local_path.relative_to(local_root)
	nebula_path = nebula_root / relative_path

	return nebula_path

def convert_server_path_to_local_path(nebula_path):

	nebula_root = get_nebula_root()
	local_root = get_filesystem_root()

	# Swap nebula root with local root to get the corresponding path in local filesystem
	relative_path = nebula_path.relative_to(nebula_root)
	local_path = local_root / relative_path

	return local_path

def convert_urdf_content_paths_from_server_path_to_local_path(urdf_path):

	nebula_root = get_nebula_root()
	local_root = get_filesystem_root()

	# Read in the urdf content
	with open(urdf_path, 'r') as file:
		urdf_content = file.read()
	# Convert any paths in the URDF content from server paths to local paths
	nebula_root = get_nebula_root()
	local_root = get_filesystem_root()
		
	# Go through the urdf content and find all occurences with the nebula root and replace with local root
	converted_urdf_content = re.sub(re.escape(str(nebula_root)), str(local_root), urdf_content)

	# Save the urdf content with converted paths to a temporary file and return the path to that file
	# Add a "_modified" suffix to the original filename to indicate that this is a modified version of the original URDF
	modified_urdf_path = urdf_path.parent / f"{urdf_path.stem}_modified{urdf_path.suffix}"
	with open(modified_urdf_path, 'w') as file:
		file.write(converted_urdf_content)

	return modified_urdf_path

def write_ptp_path_profile(workcell_name, path_name, velocity, acceleration):
    """Write motion profile (velocity, acceleration) for a PTP path to JSON."""
    folder = get_filesystem_root() / 'workcell' / workcell_name / 'point_to_point_path'
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / f'{path_name}.json'
    with open(file_path, 'w') as f:
        json.dump({'name': path_name, 'velocity': velocity, 'acceleration': acceleration}, f, indent=2)
    return file_path

def get_areas_folder(workcell_name):
    return get_filesystem_root() / 'workcell' / workcell_name / 'areas'

def get_areas_assets_folder(workcell_name):
    return get_areas_folder(workcell_name) / 'assets'

def get_generated_meshes_folder(workcell_name):
    return get_filesystem_root() / 'workcell' / workcell_name / 'generated_meshes'

def get_scene_assets_folder(workcell_name):
    return get_filesystem_root() / 'workcell' / workcell_name / 'scene' / 'assets'

def list_areas(workcell_name):
    """Return {areaName: parentObjectName} for all areas in the areas folder."""
    folder = get_areas_folder(workcell_name)
    if not folder.is_dir():
        return {}
    result = {}
    for f in sorted(folder.glob('*.json')):
        try:
            with open(f) as fh:
                data = json.load(fh)
            result[f.stem] = data.get('parentName', '')
        except Exception as e:
            print(f"Warning: failed to read area '{f}': {e}")
    return result

def write_area_json(workcell_name, area_name, parent_name):
    """Write area data to workcell/areas/{area_name}.json."""
    folder = get_areas_folder(workcell_name)
    folder.mkdir(parents=True, exist_ok=True)
    file_path = folder / f'{area_name}.json'
    with open(file_path, 'w') as f:
        json.dump({'areaName': area_name, 'parentName': parent_name}, f, indent=2)
    return file_path

def read_area_json(workcell_name, area_name):
    """Read area JSON data. Returns None if not found."""
    file_path = get_areas_folder(workcell_name) / f'{area_name}.json'
    if not file_path.is_file():
        return None
    with open(file_path) as f:
        return json.load(f)

def delete_area_json(workcell_name, area_name):
    """Delete area JSON. Returns True if deleted, False if not found."""
    file_path = get_areas_folder(workcell_name) / f'{area_name}.json'
    if not file_path.is_file():
        return False
    file_path.unlink()
    return True


def check_scene_object_local_urdf_path(workcell_name):

	local_root_path = get_filesystem_root()

	scene_root = Path(local_root_path) / 'workcell' / workcell_name / 'scene'
	candidate = scene_root / 'objects.urdf'

	if (candidate.exists()):
		return candidate.resolve()

	raise FileNotFoundError(f'No URDF found for scene objects in workcell: {workcell_name}')