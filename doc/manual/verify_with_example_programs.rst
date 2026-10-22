Verify with Example Programs
============================

The Composer Studio repository ships standalone Python scripts in
``examples/``. They call the PDK server directly, without Composer Studio, and
show the PDK calls behind each Composer Studio feature. They are also a quick
way to check that the server and your licenses work.

Run them from the repository root, with the virtual environment from
:doc:`install_composer_studio` active and a server running:

.. code-block:: bash

   python3 examples/example_workcell_service.py

Load the workcell they create in Composer Studio (:doc:`workcells`) to see the
result.

.. important::

   The examples work in a workcell called ``example_workcell``, and most of them
   **delete it first**. Do not run them against a workcell of that name that
   you want to keep.

The examples connect to ``localhost:50052``. To use another server, edit
``target`` near the top of ``main()``.

.. list-table::
   :header-rows: 1
   :widths: 34 40 26

   * - Script
     - Shows
     - Needs
   * - ``example_workcell_service.py``
     - List, delete and create workcells. :doc:`workcells`
     - server
   * - ``example_scene_service.py``
     - A scene with a robot system and objects. :doc:`scene_objects`
     - server
   * - ``example_load_workcell_system_scene.py``
     - Load ``example_workcell`` and print its systems, joint limits and serial
       number.
     - an existing ``example_workcell``
   * - ``example_component_services.py``
     - A robot system, and the component catalogue. :doc:`systems`
     - server
   * - ``example_system_setup_from_rdk.py``
     - Add a system from a connected robot, like **Sync from Controller**.
       :doc:`systems`
     - real robot; edit ``serial_number``
   * - ``example_fk_ik.py``
     - Forward and inverse kinematics. :doc:`targets`
     - server
   * - ``example_system_pose.py``
     - Save poses as targets and plan between them. :doc:`ptp_trajectories`
     - ``point_to_point_path`` license
   * - ``example_point_to_point_path.py``
     - PTP planning with several collision configurations.
       :doc:`collision_configs`
     - ``point_to_point_path`` license
   * - ``example_mesh_toolpath_sketch.py``
     - A sketch tool path on a mesh. :doc:`paths`
     - ``surface_finish`` license, mesh file
   * - ``example_mesh_toolpath_raster.py``
     - A raster tool path on a mesh. :doc:`paths`
     - ``surface_finish`` license, mesh file
   * - ``example_linear_path_trajectory_generation.py``
     - A path, robot motion with velocity, acceleration and force, and an RCA
       trajectory file. :doc:`linear_path_trajectories`
     - ``surface_finish`` license, mesh file
   * - ``example_mesh_filter.py``
     - The mesh filter. :doc:`scene_objects`
     - ``mesh_operation`` license, mesh file
   * - ``example_mesh_area_extraction.py``
     - Area extraction from a mesh. :doc:`areas`
     - ``mesh_operation`` license, mesh file
   * - ``example_camera.py``
     - A camera on a robot; save its images and point cloud. :doc:`cameras`
     - real robot and camera; edit the serial number and camera ID
   * - ``example_reconstruction.py``
     - Reconstruct the scene from camera data.
     - real robot and camera; edit the serial number and camera ID

Mesh file
---------

The examples marked *mesh file* load a 1 m × 1 m plane from
``/home/flexiv/user_data/meshes/plane_1m_10x10.obj``. The path is read **on
the server**: for a server running in a container, it is the path inside the
container, which is ``user_data/meshes/`` in the server's release folder on the
host.

The mesh is not in the Composer Studio repository. Copy it from
``examples/assets/plane_1m_10x10.obj`` in the
`Flexiv PDK repository <https://github.com/flexivrobotics/flexiv_pdk>`_.
