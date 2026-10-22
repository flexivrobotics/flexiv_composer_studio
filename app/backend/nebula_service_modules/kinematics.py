import math
import time
from .collision import DEFAULT_COLLISION_CONFIG_NAME

class KinematicsService:
    """Kinematics methods."""

    def compute_ik(
        self,
        system_name,
        target_frame_name,
        position,
        rpy_degrees,
        elbow_swivel_angle=0.0,
        joint_position_seed=None,
        external_axis_position=None,
        external_axis_preset=True,
    ):
        """Compute inverse kinematics for a system."""
        kinematics_pb2 = self._get_module("flexiv.pdk.system.kinematics_service_pb2")
        geometry_pb2 = self._get_module("flexiv.pdk.spatial.geometry_pb2")
        waypoint_pb2 = self._get_module("flexiv.pdk.spatial.waypoint_pb2")
        solver_options_pb2 = self._get_module("flexiv.pdk.common.solver_options_pb2")

        roll, pitch, yaw = [math.radians(d) for d in rpy_degrees]

        cr, sr = math.cos(roll * 0.5), math.sin(roll * 0.5)
        cp, sp = math.cos(pitch * 0.5), math.sin(pitch * 0.5)
        cy, sy = math.cos(yaw * 0.5), math.sin(yaw * 0.5)

        qw = cr * cp * cy + sr * sp * sy
        qx = sr * cp * cy - cr * sp * sy
        qy = cr * sp * cy + sr * cp * sy
        qz = cr * cp * sy - sr * sp * cy

        nullspace_kwargs = {"elbow_swivel_angle": elbow_swivel_angle}
        if external_axis_position is not None:
            nullspace_kwargs["external_robot_position"] = [
                float(v) for v in external_axis_position
            ]

        ik_kwargs = {
            "system_name": system_name,
            "target_frame_name": target_frame_name,
            "target_pose": geometry_pb2.SE3Pose(
                position=geometry_pb2.Vector3(
                    x=position[0], y=position[1], z=position[2]
                ),
                rotation=geometry_pb2.Quaternion(x=qx, y=qy, z=qz, w=qw),
            ),
            "null_space": waypoint_pb2.NullSpace(**nullspace_kwargs),
            "collision_config_name": DEFAULT_COLLISION_CONFIG_NAME,
        }
        if joint_position_seed is not None:
            ik_kwargs["joint_position_seed"] = [float(v) for v in joint_position_seed]
        if external_axis_position is not None:
            ik_kwargs["external_robot_axis"] = (
                solver_options_pb2.EXTERNAL_ROBOT_PRESET
                if external_axis_preset
                else solver_options_pb2.EXTERNAL_ROBOT_PREFERRED
            )

        with self._create_client() as client:
            response = client.kinematics.stub.ComputeIK(kinematics_pb2.IKRequest(**ik_kwargs))
        #time.sleep(0.1)
        code, msg = self._check_status(response, "IK computation")       

        return {
            "solution": list(getattr(response, "solution", []) or []),
            "status": {"code": code, "message": msg},
        }

    def compute_fk(self, system_name, target_frame_name, joint_positions):
        """Compute forward kinematics for a system: the world pose of ``target_frame_name`` at ``joint_positions``."""
        kinematics_pb2 = self._get_module("flexiv.pdk.system.kinematics_service_pb2")

        request = kinematics_pb2.FKRequest(
            system_name=system_name,
            target_frame_name=target_frame_name,
            joint_positions=[float(v) for v in joint_positions],
        )

        with self._create_client() as client:
            response = client.kinematics.stub.ComputeFK(request)
        code, msg = self._check_status(response, "FK computation")

        pose = response.pose
        return {
            "position": {"x": pose.position.x, "y": pose.position.y, "z": pose.position.z},
            "rotation": {
                "x": pose.rotation.x, "y": pose.rotation.y, "z": pose.rotation.z, "w": pose.rotation.w,
            },
            "status": {"code": code, "message": msg},
        }