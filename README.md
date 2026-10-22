# Flexiv Composer Studio

A scene-authoring and scan-path editing tool for Flexiv PDK workcells. It provides a visual
editor (Vue 3 + Three.js) backed by a FastAPI service that talks to a running PDK server over
gRPC to set up targets and plan point-to-point/linear/raster/sketch toolpaths on real or simulated
manipulators.

## Repository layout

```
.
├── app/
│   ├── backend/           FastAPI server (Python)
│   │   ├── nebula_service_modules/
│   │   └── web_routes/
│   ├── frontend/          Vue 3 + Vite single-page app
│   │   └── src/components/{setups,controls,tools,tree,editors,dialogs}
│   ├── install_dependencies.sh  Install the backend's Python packages
│   └── run_app.sh          Build frontend, launch backend, open browser
└── examples/               Standalone scripts demonstrating the PDK gRPC API
```

The gRPC/protobuf API is provided entirely by the `flexivpdk` package
(import root `flexiv.pdk`); this repo does not carry its own copy of the
`.proto` definitions or generated stubs.

## Requirements

- Python 3.9+
- Node.js 18+ / npm
- A reachable PDK server (gRPC, defaults to `localhost:50052`)
- **Flexiv PDK** (package `flexivpdk`, import root
  `flexiv.pdk`) — a prerequisite installed separately (see Setup below). It
  provides the `flexiv.pdk` runtime used by the backend *and* the
  `pdk-scene` command-line tool that is useful alongside this GUI.

## Setup

Install the backend dependencies, Flexiv RDK and Flexiv PDK into
the active Python environment:

```bash
cd app
bash install_dependencies.sh
```

That installs the newest `flexivpdk`. To match the server of an older Flexiv PDK
release, name its version, such as `1.0.0`:

```bash
bash install_dependencies.sh --pdk-version <version>
```

`--test-pypi pdk` takes a package Flexiv support published on test PyPI for you,
by its exact version.

`--test-pypi` takes `pdk`, `rdk` or `pdk,rdk`. Run with `--help` for all options.

Install frontend dependencies:

```bash
cd app/frontend
npm install
```

## Running in development

```bash
cd app
./run_app.sh
```

This builds the frontend, starts the backend at `http://localhost:8011`, and opens it in your
default browser. To iterate on the frontend with hot reload instead, run `npm run dev` inside
`frontend/` and the backend separately with `python3 backend/web_server.py`.

## Examples

`examples/` contains standalone scripts (`example_system_pose.py`, `example_mesh_toolpath_raster.py`,
etc.) that exercise the PDK gRPC API directly — useful references for the service calls the
backend wraps.
