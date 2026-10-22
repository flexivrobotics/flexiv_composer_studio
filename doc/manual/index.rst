Flexiv Composer Studio Manual
=============================

`Composer Studio repository <https://github.com/flexivrobotics/flexiv_composer_studio>`_

Flexiv Composer Studio is a browser-based editor for Flexiv PDK workcells. It
lets you set up robot systems, objects and cameras in 3D, draw tool paths on
meshes, and plan point-to-point and linear-path trajectories, all without
writing code. It runs on top of a running PDK server and the Flexiv PDK
Python package.

This manual documents Composer Studio for PDK release |version_full|.

.. important::
   Composer Studio must be used with a PDK server of the same release as the
   installed ``flexivpdk`` package. Composer Studio can connect to and
   **enable** real robots. Before connecting to a real robot, you must
   carefully read through all documents shipped with the robot and strictly
   follow **all safety instructions** detailed in these documents.

Overview
-----------------

.. toctree::
   :maxdepth: 2
   :caption: Overview

   what_is_composer_studio
   environment_compatibility

Installation
-----------------

.. toctree::
   :maxdepth: 2
   :caption: Installation

   install_composer_studio
   launch_composer_studio

First Time Setup
-----------------

.. toctree::
   :maxdepth: 2
   :caption: First Time Setup

   activate_licenses
   build_your_first_workcell

Using Composer Studio
---------------------

.. toctree::
   :maxdepth: 2
   :caption: Using Composer Studio

   interface_overview
   workcells
   systems
   custom_components
   scene_objects
   cameras
   collision_configs

Motion and Tool Paths
---------------------

.. toctree::
   :maxdepth: 2
   :caption: Motion and Tool Paths

   targets
   areas
   paths
   ptp_trajectories
   linear_path_trajectories

Real Robots and Live Data
-------------------------

.. toctree::
   :maxdepth: 2
   :caption: Real Robots and Live Data

   connect_to_robot
   live_scene_events

Examples
-----------------

.. toctree::
   :maxdepth: 2
   :caption: Examples

   verify_with_example_programs

Troubleshooting
-----------------

.. toctree::
   :maxdepth: 2
   :caption: Troubleshooting

   troubleshooting
