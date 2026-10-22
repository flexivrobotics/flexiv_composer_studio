"""Pose/quaternion math shared by service modules that convert between world
frame and a scene object's local frame (e.g. toolpath.py, scene_object.py).

Positions are plain {"x", "y", "z"} dicts and quaternions are plain
{"x", "y", "z", "w"} dicts throughout, matching the shapes already used for
Nebula proto (de)serialization elsewhere in this backend.
"""
import math


def rpy_to_quat(rpy):
    """Quaternion {x,y,z,w} of fixed-axis roll, pitch, yaw (rad), as in URDF."""
    hr, hp, hy = (0.5 * float(a) for a in rpy)
    cr, sr = math.cos(hr), math.sin(hr)
    cp, sp = math.cos(hp), math.sin(hp)
    cy, sy = math.cos(hy), math.sin(hy)
    return {
        "x": sr * cp * cy - cr * sp * sy,
        "y": cr * sp * cy + sr * cp * sy,
        "z": cr * cp * sy - sr * sp * cy,
        "w": cr * cp * cy + sr * sp * sy,
    }


def quat_to_rpy(q):
    """Fixed-axis roll, pitch, yaw (rad), as in URDF, of a quaternion {x,y,z,w}."""
    x, y, z, w = q["x"], q["y"], q["z"], q["w"]
    norm = math.sqrt(x * x + y * y + z * z + w * w)
    if norm == 0.0:
        return [0.0, 0.0, 0.0]
    x, y, z, w = x / norm, y / norm, z / norm, w / norm
    roll = math.atan2(2.0 * (w * x + y * z), 1.0 - 2.0 * (x * x + y * y))
    pitch = math.asin(max(-1.0, min(1.0, 2.0 * (w * y - z * x))))
    yaw = math.atan2(2.0 * (w * z + x * y), 1.0 - 2.0 * (y * y + z * z))
    return [roll, pitch, yaw]


def quat_conjugate(q):
    """Inverse of a unit quaternion {x,y,z,w}."""
    return {"x": -q["x"], "y": -q["y"], "z": -q["z"], "w": q["w"]}


def quat_multiply(a, b):
    """Hamilton product a * b of two quaternions {x,y,z,w}."""
    ax, ay, az, aw = a["x"], a["y"], a["z"], a["w"]
    bx, by, bz, bw = b["x"], b["y"], b["z"], b["w"]
    return {
        "x": aw * bx + ax * bw + ay * bz - az * by,
        "y": aw * by - ax * bz + ay * bw + az * bx,
        "z": aw * bz + ax * by - ay * bx + az * bw,
        "w": aw * bw - ax * bx - ay * by - az * bz,
    }


def quat_rotate_vector(q, v):
    """Rotate 3-vector v=(x,y,z) by quaternion q={x,y,z,w}."""
    qx, qy, qz, qw = q["x"], q["y"], q["z"], q["w"]
    vx, vy, vz = v
    tx = 2.0 * (qy * vz - qz * vy)
    ty = 2.0 * (qz * vx - qx * vz)
    tz = 2.0 * (qx * vy - qy * vx)
    return (
        vx + qw * tx + (qy * tz - qz * ty),
        vy + qw * ty + (qz * tx - qx * tz),
        vz + qw * tz + (qx * ty - qy * tx),
    )


def local_to_world_pose(parent_position, parent_quaternion, local_position, local_rotation):
    """Express a parent-frame-relative {position, rotation} pose in world
    coordinates."""
    local_vec = (local_position["x"], local_position["y"], local_position["z"])
    rotated = quat_rotate_vector(parent_quaternion, local_vec)
    world_pos = {
        "x": rotated[0] + parent_position["x"],
        "y": rotated[1] + parent_position["y"],
        "z": rotated[2] + parent_position["z"],
    }
    world_rot = quat_multiply(parent_quaternion, local_rotation)
    return world_pos, world_rot


def local_to_world_point(parent_position, parent_quaternion, local_point):
    """Express a flat {x, y, z} parent-frame-relative point in world
    coordinates."""
    local_vec = (local_point["x"], local_point["y"], local_point["z"])
    rotated = quat_rotate_vector(parent_quaternion, local_vec)
    return {
        "x": rotated[0] + parent_position["x"],
        "y": rotated[1] + parent_position["y"],
        "z": rotated[2] + parent_position["z"],
    }


def world_to_local_point(parent_position, parent_quaternion, world_point):
    """Express a flat {x, y, z} world-frame point relative to a parent pose."""
    parent_quat_inv = quat_conjugate(parent_quaternion)
    delta = (
        world_point["x"] - parent_position["x"],
        world_point["y"] - parent_position["y"],
        world_point["z"] - parent_position["z"],
    )
    local = quat_rotate_vector(parent_quat_inv, delta)
    return {"x": local[0], "y": local[1], "z": local[2]}


def world_rotation_to_local(parent_quaternion, world_rotation):
    """Express a world-frame rotation {x,y,z,w} relative to a parent
    orientation."""
    return quat_multiply(quat_conjugate(parent_quaternion), world_rotation)
