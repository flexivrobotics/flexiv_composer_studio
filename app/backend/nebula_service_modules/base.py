import importlib
import threading
from contextlib import contextmanager


class NebulaServiceBase:
    """Common Nebula client and status helpers."""

    # Class-level reentrant lock: only one nebula operation runs at a time across
    # all instances. RLock allows the same thread to re-enter (e.g. generate_toolpath
    # calls list_toolpaths internally while holding the lock).
    _lock = threading.RLock()

    def __init__(self, target):
        self.target = target
        self._module_cache = {}

    def _get_module(self, name):
        """Lazy load and cache a module."""
        if name not in self._module_cache:
            self._module_cache[name] = importlib.import_module(name)
        return self._module_cache[name]

    @contextmanager
    def _create_client(self):
        """Context manager that serializes nebula calls and yields a connected client."""
        with self._lock:
            grpc = self._get_module("grpc")
            try:
                Client = self._get_module("flexiv.pdk").Client
            except ModuleNotFoundError as exc:
                raise RuntimeError(
                    "flexiv.pdk is not available. Install the Flexiv Nebula "
                    "SDK with app/install_dependencies.sh, or "
                    "'pip install flexivpdk'."
                ) from exc

            channel = grpc.insecure_channel(self.target)
            grpc.channel_ready_future(channel).result(timeout=2)

            yield Client(self.target)

    def _check_status(self, response, context):
        """Extract and check status from Nebula response."""
        status = getattr(response, "status", None)
        code = getattr(status, "code", 0) if status is not None else 0
        message = getattr(status, "message", "") if status is not None else ""

        if code != 0:
            raise RuntimeError(f"{context} failed: {message} (code: {code})")
        return code, message

    def _list_loaded_system_names(self, client):
        """List names of all loaded systems in the current config."""
        config_pb2 = self._get_module("flexiv.pdk.config_service_pb2")
        request = config_pb2.ListConfigRequest(type=config_pb2.ConfigType.CONFIG_TYPE_SYSTEM)
        response = client.config.stub.List(request)
        return list(getattr(response, "names", []))
