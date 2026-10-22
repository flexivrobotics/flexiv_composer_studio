What Is Flexiv Composer Studio?
===============================

Flexiv Composer Studio is a graphical editor for building robotic applications
on the Flexiv PDK (Planning Development Kit). Everything it does, it does by
calling the PDK server, so a workcell built in Composer Studio is the same
workcell your own PDK programs see.

What Composer Studio provides
-----------------------------

1. **Scene authoring.** Create workcells, and add robot systems (manipulator,
   external axis, tool adapter and tool), mesh and box objects, and cameras.
   Position everything in a 3D view.
2. **Robot posing.** Pose a robot with joint sliders, by typing a Cartesian
   pose, or by dragging its TCP in the viewport, and save the pose as a
   *target*.
3. **Tool paths.** Cut an *area* out of a mesh, then sketch a path on the
   surface or generate a raster (zig-zag) path that covers the area.
4. **Trajectories.** Plan collision-free point-to-point (PTP) motion through
   saved targets, or robot motion that follows a tool path at a given speed,
   force and moment. Play either back in the viewport.
5. **Workcell utilities.** Edit collision configurations, define custom tools
   and tool adapters, install licenses, filter meshes, and connect to a real
   robot to watch its live position.

Architecture
------------

.. code-block:: text

   ┌──────────────┐  HTTP / WebSocket  ┌─────────────────────┐   gRPC    ┌──────────────┐
   │  Web browser │ ◀────────────────▶ │  Composer Studio    │ ◀───────▶ │  PDK server  │
   │  (Vue 3 +    │   localhost:8011   │  backend (FastAPI,  │  :50052   │              │
   │   Three.js)  │                    │  Python, flexiv.pdk)│           │  workcells,  │
   └──────────────┘                    └──────────┬──────────┘           │  planning,   │
                                                  │ RDK (flexivrdk)      │  licenses    │
                                                  ▼                      └──────────────┘
                                          Flexiv robots

* The **PDK server** owns all state: workcells, objects, paths, trajectories
  and licenses. Composer Studio keeps only two things of its own, as files in
  the workcell's folder: which object each area belongs to (``areas/``) and
  the velocity and acceleration entered for each PTP trajectory
  (``point_to_point_path/``).
* The **backend** is a small Python web server. It translates the editor's
  requests into PDK calls, and reads and writes mesh and URDF files in the
  *PDK Release Folder* (:doc:`launch_composer_studio`).
* The **editor** runs in your browser and draws the scene with WebGL.

Things to know before you start
-------------------------------

* **Composer Studio runs on the same computer as the PDK server.** It works
  directly on the server's workcell files. See :doc:`environment_compatibility`.
* **There is no Save button.** Every create, modify and delete is sent to the
  server as soon as you confirm it.
* **A workcell must be loaded** before you can add anything to the scene. See
  :doc:`workcells`.
* **Some features need a license** on the server: PTP trajectories, tool paths,
  linear path trajectories, areas and the mesh filter. See
  :doc:`activate_licenses`.
* **Robot motion is planned and previewed, not executed.** Composer Studio
  shows trajectories in the viewport only. Connecting to a real robot enables
  it and reads its live position, but does not move it. See
  :doc:`connect_to_robot`.

Where to go next
----------------

* :doc:`install_composer_studio` to install Composer Studio.
* :doc:`build_your_first_workcell` for a guided first session.
* :doc:`interface_overview` for a tour of the editor.
