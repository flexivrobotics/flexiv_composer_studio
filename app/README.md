# Nebula Basic Application

This application demonstrates a basic integration with the Flexiv Nebula system using a Python backend and a Vue.js/Vite frontend.

## Prerequisites

- **Python 3.8+**
- **Node.js (LTS)** and **npm**

## Installation

### 1. Install Node.js and npm

If you do not have Node.js and npm installed, it is recommended to use [nvm](https://github.com/nvm-sh/nvm) (Node Version Manager):

```bash
# Install nvm (Ubuntu/Linux)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load nvm
source ~/.bashrc

# Install Node.js (LTS)
nvm install --lts
```

Alternatively, you can install it via your system's package manager:

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install nodejs npm
```

### 2. Install Python Packages

From this directory, install the backend requirements, Flexiv RDK and the
**Flexiv Nebula SDK**:

```bash
bash install_dependencies.sh
```

The primary dependencies include:
- `fastapi`: Web framework for the API.
- `uvicorn`: ASGI server for running the FastAPI app.
- `python-multipart`: For handling form data and file uploads.
- `flexivpdk`: SDK for interacting with Nebula services (includes `grpcio`).

### 3. Install npm Packages (Frontend)

Navigate to the frontend directory and install the dependencies:

```bash
cd frontend
npm install
```

The frontend uses the following key packages:
- `vue`: Frontend framework.
- `three`: 3D rendering library.
- `vite`: Build tool and dev server.
- `typescript`: For type-safe development.

---

## Running the Application

A helper script is provided to build the frontend and start the backend server.

From the `composer_studio` root directory:

```bash
bash run_app.sh
```

This script will:
1. Build the frontend production assets into the `frontend/dist` directory.
2. Start the Python web server on port `8011`.

You can then access the application at `http://localhost:8011`.
