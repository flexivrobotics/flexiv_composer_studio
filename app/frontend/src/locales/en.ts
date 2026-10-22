/**
 * English locale messages for composer_studio.
 *
 * Key convention: `section.subsection.key`
 * Interpolation: `{placeholder}` tokens resolved by t('key', { placeholder: 'value' })
 */
const en = {
	app: {
		title: 'Flexiv Composer Studio',
		workcellRoot: 'PDK Release Folder:',
		enterFullscreen: 'Enter full screen',
		exitFullscreen: 'Exit full screen',
		nav: {
			workcellSetup: 'Workcell Setup',
			liveSceneEventsOn: 'Live Scene Events On',
			liveSceneEventsOff: 'Live Scene Events Off',
			liveSceneEventsConfirm: 'Turning on Live Scene Events will actively sync the scene with any server events. While it is on, all UI scene interaction will be deactivated.',
		},
		loading: 'Loading system configuration…',
		tabs: {
			moreSetup: 'More setup',
		},
		panel: {
			backToNavigator: 'Scene Navigator',
		},
	},

	dialog: {
		confirm: {
			cancel: 'Cancel',
			ok: 'OK',
			yes: 'Yes',
			no: 'No',
		},
		invalidRoot: {
			title: 'PDK Release Folder Not Found',
			message: 'The path "{path}" does not exist. Please specify a valid Nebula release folder to continue.',
			apply: 'Apply',
		},
		workcell: {
			title: 'Workcell Setup',
			newTitle: 'New Workcell',
			loading: 'Loading workcells…',
			empty: 'No workcells found.',
			noDescription: 'No description available for this workcell.',
			label: {
				available: 'Available Workcells',
				name: 'Name',
				description: 'Description',
			},
			placeholder: {
				select: 'Select a workcell...',
				name: 'Enter workcell name',
				description: 'Optional description',
			},
			button: {
				cancel: 'Cancel',
				new: 'New',
				delete: 'Delete',
				deleting: 'Deleting…',
				load: 'Load',
				loading: 'Loading…',
				create: 'Create',
				creating: 'Creating…',
			},
			description: 'Description',
			confirmDelete: 'Delete workcell "{name}"? This action cannot be undone.',
		},
	},

	setup: {
		trajectory: {
			title: 'Setup Trajectory',
			titlePtp: 'Setup PTP Trajectory',
			titleLinear: 'Setup Linear Path Trajectory',
			label: {
				name: 'Name',
				normalOffset: 'Normal Offset',
				elbowSwivelAngle: 'Elbow Swivel Angle (deg)',
				externalAxisPosition: 'External Axis Position (deg)',
			},
			placeholder: {
				name: 'Enter trajectory name',
			},
			button: {
				create: 'Create Trajectory',
				solving: 'Solving…',
			},
			tab: {
				fromTargets: 'From Targets',
				fromPath: 'Selected Path for Trajectory Generation',
			},
			transfer: {
				available: 'Available Targets',
				selected: 'Trajectory Targets',
				empty: 'None',
				loading: 'Loading…',
			},
			motionProfile: {
				title: 'Motion Profile',
				velocity: 'Velocity',
				acceleration: 'Acceleration',
			},
			collisionConfig: {
				title: 'Collision Configuration',
				collisionMargin: 'Collision Margin',
			},
			saveError: 'Failed to save trajectory:',
		},
		target: {
			title: 'Setup Target',
			label: {
				name: 'Name',
			},
			placeholder: {
				name: 'Enter target name',
			},
			button: {
				create: 'Create Target',
				tcpDrag: 'TCP Dragging',
				stopTcpDrag: 'Stop TCP Dragging',
			},
			tab: {
				jointSpace: 'Joint Space',
				cartesianSpace: 'Cartesian Space',
			},
			saveError: 'Failed to save target:',
			duplicateName: 'A target named "{name}" already exists.',
			collisionWarning: 'This joint configuration is in collision or unreachable.',
			collisionCheckError: 'Collision check failed: {message}',
		},
		area: {
			title: 'Setup Area',
			label: {
				parent: 'Parent',
				name: 'Name',
			},
			placeholder: {
				name: 'Enter area name',
			},
			button: {
				create: 'Create Area',
				extracting: 'Extracting Area...',
				clearPoints: 'Clear points',
			},
			tab: {
				freeDraw: 'Free draw',
				generateFromMesh: 'Generate from mesh',
			},
			hint: {
				clickObject: 'Double-click on the object in the visualizer to place area points.',
			},
			error: {
				notEnoughPoints: 'Place at least 3 points on the object to create an area.',
				createFailed: 'Could not create the area: {message}',
			},
		},
		path: {
			title: 'Setup Path',
			label: {
				sceneObject: 'Scene Object',
				name: 'Name',
				pointSpacing: 'Point spacing (m)',
				blendingRadius: 'Blending radius (m)',
				area: 'Area',
				fixedSpacing: 'Fixed spacing (m)',
				borderOffset: 'Border offset (m)',
				rasterLineSpacing: 'Raster line spacing (m)',
				rasterJoiningThreshold: 'Joining threshold (m)',
				rasterDirection: 'Raster direction',
				principalAngle: 'Principal angle',
				specifiedDirection: 'Specified direction',
				principalRotationAngle: 'Rotation angle (deg)',
				rasterFlip: 'Flip raster start',
				orientationAlignment: 'Orientation alignment',
				alignWithInitialDirection: 'Align with initial direction',
				alignWithPrevious: 'Align with previous waypoint',
				alignWithDirection: 'Align with direction in world',
			},
			placeholder: {
				name: 'Enter path name',
				selectArea: 'Select an area',
				noAreas: 'No areas available',
			},
			tab: {
				freeSketch: 'Free sketch',
				generateFromArea: 'Generate from area',
			},
			subTab: {
				parameters: 'Parameters',
				orientationAlignment: 'Orientation',
			},
			hint: {
				clickObject: 'Double-click on the object in the visualizer to specify the waypoints.',
				generatePlaceholder: 'Generate from area options will go here.',
			},
			error: {
				notEnoughWaypoints: 'Place at least 2 waypoints on the object to create a path.',
				createFailed: 'Could not create the path: {message}',
			},
			button: {
				create: 'Create Path',
				creating: 'Creating Path...',
				clearWaypoints: 'Clear waypoints',
				generate: 'Generate Path',
				visualizeToolpath: 'Visualize Toolpath',
			},
		},
		sceneObject: {
			title: 'Setup Scene Object',
			label: {
				name: 'Name',
				parent: 'Parent',
				requiredMtl: 'Required .mtl file',
				shape: 'Shape',
				sizeX: 'Size X (m)',
				sizeY: 'Size Y (m)',
				sizeZ: 'Size Z (m)',
				pose: 'Pose',
			},
			placeholder: {
				name: 'Enter scene object name',
			},
			option: {
				world: 'world',
			},
			tab: {
				mesh: 'Mesh',
				primitives: 'Primitive Shapes',
			},
			status: {
				noFile: 'No file selected',
				required: 'Required: {filename}',
				uploading: 'Uploading…',
				inserting: 'Inserting…',
			},
			shape: {
				box: 'Box',
			},
			button: {
				selectObj: 'Select .obj File',
				selectMtl: 'Select .mtl File',
				insertMesh: 'Insert',
				insertBox: 'Insert',
			},
		},
		system: {
			editTitle: 'Edit System',
			createTitle: 'Setup System',
			label: {
				systemName: 'System Name',
				name: 'Name',
				armSerial: 'Arm Serial Number',
				controlBoxSerial: 'Control Box Serial Number',
				manufacturer: 'Manufacturer',
				model: 'Model',
				poseTitle: 'Pose',
				x: 'X (m)',
				y: 'Y (m)',
				z: 'Z (m)',
				roll: 'Roll (deg)',
				pitch: 'Pitch (deg)',
				yaw: 'Yaw (deg)',
			},
			placeholder: {
				name: 'e.g. my_robot',
				manipulator: 'e.g. my_manipulator',
				armSerial: 'e.g. A02L-00-M3-000001',
				controlBoxSerial: 'e.g. CX01-01-T1-000001',
				extAxisName: 'e.g. linear_rail_1',
				toolAdapter: 'e.g. sander_adapter',
				tool: 'e.g. sander',
				selectManufacturer: '-- Select manufacturer --',
				selectModel: '-- Select model --',
			},
			tab: {
				manipulator: 'Manipulator',
				externalAxis: 'External Axis',
				tool: 'Tool',
				mounting: 'Mounting',
			},
			subTab: {
				toolAdapter: 'Tool Adapter',
				tool: 'Tool',
				systemMount: 'System Mount',
				manipulatorMount: 'Manipulator Mount',
			},
			hint: {
				systemMount: 'Position and orientation of the system mount in the world frame.',
				manipulatorMount: 'Position and orientation of the manipulator adapter relative to the system mount...',
			},
			feedback: {
				modifying: 'Modifying…',
				creating: 'Creating…',
				deleting: 'Deleting…',
				syncing: 'Syncing…',
				loadingAxes: 'Loading available axes…',
				noAxes: 'No external axes available from server.',
				loadingAdapters: 'Loading available tool adapters…',
				noAdapters: 'No tool adapters available from server.',
				loadingTools: 'Loading available tools…',
				noTools: 'No tools available from server.',
			},
			error: {
				nameRequired: 'Please specify a system name first.',
				duplicateName: 'A system named "{name}" already exists.',
				missingRequired: 'Please fill in the required fields: {fields}.',
			},
			prompt: {
				serialNumber: 'Please specify the public serial number of the robot.',
				serialNumberPlaceholder: 'Public serial number',
			},
			button: {
				modify: 'Modify System',
				create: 'Create System',
				delete: 'Delete System',
				sync: 'Sync from Controller',
			},
		},

		camera: {
			editTitle: 'Edit Camera',
			createTitle: 'Setup Camera',
			label: {
				name: 'Name',
				parent: 'Parent Frame',
				poseTitle: 'Pose',
				cameraId: 'Camera ID',
				farWidth: 'Far Plane Width (m)',
				farHeight: 'Far Plane Height (m)',
				farDistance: 'Far Plane Distance (m)',
				nearDistance: 'Near Plane Distance (m)',
				depthScale: 'Depth Scale',
				syncFromDevice: 'Sync far width / height from camera device',
			},
			placeholder: {
				name: 'e.g. my_camera',
			},
			option: {
				world: 'world',
			},
			hint: {
				optics: 'View frustum and depth parameters.',
			},
			feedback: {
				modifying: 'Modifying…',
				creating: 'Creating…',
				deleting: 'Deleting…',
				syncingFromDevice: 'Syncing from device…',
			},
			error: {
				duplicateName: 'A camera named "{name}" already exists.',
				missingRequired: 'Please fill in the required fields: {fields}.',
			},
			warning: {
				deviceNotOnline: 'Camera "{name}" is not online — far width/height could not be synced.',
			},
			button: {
				modify: 'Modify Camera',
				create: 'Create Camera',
				delete: 'Delete Camera',
			},
		},

		customComponents: {
			title: 'Custom Tool Adapter / Tool',
			tab: {
				toolAdapter: 'Tool Adapter',
				tool: 'Tool',
			},
			feedback: {
				loadingCustomToolAdapters: 'Loading custom tool adapters…',
				noCustomToolAdapters: 'No custom tool adapters available.',
				loadingCustomTools: 'Loading custom tools…',
				noCustomTools: 'No custom tools available.',
				saving: 'Saving…',
				saved: 'Tool adapter saved.',
				savedTool: 'Tool saved.',
				removedToolAdapter: 'Tool adapter removed.',
				removedTool: 'Tool removed.',
			},
			tableHeader: {
				manufacturer: 'Manufacturer',
				model: 'Model',
			},
			label: {
				manufacturer: 'Manufacturer',
				model: 'Model',
				flangePoses: 'Flange Pose',
				tcpPose: 'TCP Pose',
				visualMesh: 'Visual Mesh',
				collisionMesh: 'Collision Mesh',
				preview: 'Preview',
			},
			placeholder: {
				manufacturer: 'e.g. Flexiv',
				model: 'e.g. sander_adapter',
			},
			button: {
				addToolAdapter: 'Add Tool Adapter',
				addTool: 'Add Tool',
				addFlange: 'Add Flange',
				removeFlange: 'Remove Flange',
				selectFile: 'Select File',
				save: 'Save',
				cancel: 'Cancel',
				remove: 'Remove',
			},
			status: {
				noFile: 'No file selected',
			},
			confirm: {
				removeToolAdapter: 'Remove tool adapter "{model}"?',
				removeTool: 'Remove tool "{model}"?',
			},
			warning: {
				toolAdapterInUse: 'Tool adapter "{model}" is currently used by system(s): {systems}. Remove it anyway?',
				toolInUse: 'Tool "{model}" is currently used by system(s): {systems}. Remove it anyway?',
			},
			error: {
				missingRequired: 'Please specify a manufacturer and model.',
			},
		},

		collisionConfig: {
			title: 'Collision Configs',
			notice: 'Only the config named "default" is currently used by IK checks and PTP motion planning. Other configs are saved but inactive until something elsewhere is changed to use them.',
			tableHeader: {
				name: 'Name',
				margin: 'Margin (m)',
				pairs: 'Pairs',
			},
			label: {
				name: 'Name',
				margin: 'Collision Margin (m)',
				pairs: 'Excluded Pairs',
				pairName1: 'Component 1',
				pairName2: 'Component 2',
				activeBadge: 'active',
			},
			placeholder: {
				name: 'Enter config name',
			},
			button: {
				create: 'Create Config',
				rename: 'Rename',
				delete: 'Delete',
				save: 'Save',
				cancel: 'Cancel',
				select: 'Edit',
				addPair: 'Add Pair',
				removePair: 'Remove',
			},
			feedback: {
				loading: 'Loading collision configs…',
				noConfigs: 'No collision configs saved.',
				saving: 'Saving…',
				created: 'Collision config created.',
				renamed: 'Collision config renamed.',
				removed: 'Collision config removed.',
				marginSaved: 'Collision margin saved.',
				pairAdded: 'Pair added.',
				pairRemoved: 'Pair removed.',
				noPairs: 'No excluded pairs.',
			},
			confirm: {
				rename: 'Rename collision config "{name}"?',
				renameDefault: 'Warning: "{name}" is the collision config actively used by IK checks and PTP motion planning. Renaming it means those checks will fall back to an empty, unnamed default config. Continue?',
				remove: 'Remove collision config "{name}"?',
				removeDefault: 'Warning: "{name}" is the collision config actively used by IK checks and PTP motion planning. Deleting it will remove all collision-margin and exclusion-pair settings currently in effect. Continue?',
			},
			error: {
				missingName: 'Please enter a name.',
			},
		},

		license: {
			title: 'License Manager',
			tabs: {
				status: 'Status',
				install: 'Install License',
			},
			label: {
				deviceIdentifier: 'Device Identifier',
				hardwareVerifiable: 'Hardware Verifiable',
				tpmAvailable: 'Security Chip (TPM)',
				tpmDetail: 'TPM Detail',
				warnings: 'Warnings',
				licenseFile: 'License File',
			},
			tableHeader: {
				expires: 'Expires',
				licenseId: 'License ID',
				customer: 'Customer',
				issued: 'Issued',
				services: 'Services',
				hardwareVerified: 'Hardware Verified',
				notes: 'Notes',
			},
			value: {
				never: 'Never',
				yes: 'Yes',
				no: 'No',
			},
			placeholder: {
				noFileSelected: 'No file selected.',
			},
			button: {
				refresh: 'Refresh',
				chooseFile: 'Choose File',
				install: 'Install License',
				export: 'Export',
			},
			feedback: {
				loading: 'Loading license status…',
				exported: 'Saved license_identifier.txt.',
				saving: 'Installing…',
				installSuccess: 'License installed. Newly licensed: {services}',
				installSuccessNone: 'License installed.',
				noLicenses: 'No licenses installed on this computer.',
				noWarnings: '',
			},
			error: {
				missingRequired: 'Please choose a license file.',
			},
		},
	},

	tree: {
		category: {
			systems: 'Systems',
			sceneObjects: 'Scene Objects',
			cameras: 'Cameras',
			areas: 'Areas',
			paths: 'Paths',
			targets: 'Targets',
			ptpTrajectories: 'PTP Trajectories',
			linearTrajectories: 'Linear Path Trajectories',
			collisionConfigs: 'Collision Configs',
			customComponents: 'Custom Components',
			license: 'License Manager',
		},
		empty: {
			systems: 'No systems loaded',
			sceneObjects: 'No scene objects loaded',
			cameras: 'No cameras loaded',
			areas: 'No areas loaded',
			paths: 'No paths loaded',
			targets: 'No targets loaded',
			ptpTrajectories: 'No PTP trajectories',
			linearTrajectories: 'No linear path trajectories',
		},
		action: {
			addArea: 'Add Area',
			addPath: 'Add Path',
			addTarget: 'Add Target Trajectory',
			addPtpTrajectory: 'Add PTP Trajectory',
			addLinearTrajectory: 'Add Linear Path Trajectory',
			remove: 'Remove',
			editRemove: 'Edit / Remove',
		},
		confirm: {
			removeSceneObject: 'Remove scene object "{name}"?',
			removeCamera: 'Remove camera "{name}"?',
			removeItem: 'Remove item "{name}"?',
			removePath: 'Remove path "{name}"?',
			removeTarget: 'Remove target "{name}"?',
			removeArea: 'Remove area "{name}"?',
			removeTrajectory: 'Remove trajectory "{name}"?',
		},
	},

	info: {
		loading: 'Loading…',
		empty: 'Select a system, scene object, or path to view details.',
		trajectory: {
			type: 'Type',
			system: 'System',
			ptp: 'Point-to-Point',
			linear: 'Linear',
		},
		ptpTrajectory: {
			title: 'PTP Trajectory',
			label: {
				playback: 'Playback',
			},
			button: {
				visualize: 'Visualize Trajectory',
				loading: 'Loading…',
				stop: 'Stop',
			},
		},
		linearTrajectory: {
			title: 'Linear Path Trajectory',
			label: {
				tcp: 'TCP',
				normalOffset: 'Normal Offset',
				waypointCount: 'Waypoints',
				pathForceMoment: 'Path Force / Moment',
				pathMotion: 'Path Motion',
				velocity: 'Velocity',
				acceleration: 'Acceleration',
				playback: 'Playback',
			},
			tableHeader: {
				index: '#',
				velocity: 'Velocity (m/s)',
				acceleration: 'Accel (m/s²)',
				force: 'Force (N)',
				moment: 'Moment (Nm)',
			},
			button: {
				visualize: 'Visualize Trajectory',
				loading: 'Loading…',
				stop: 'Stop',
			},
		},
		tab: {
			information: 'Information',
			setup: 'Setup',
			position: 'Position',
			operations: 'Operations',
		},
		label: {
			name: 'Name',
			type: 'Type',
			dof: 'DoF',
			system: 'System',
			tcp: 'TCP',
			position: 'Position',
			orientation: 'Orientation',
			parent: 'Parent',
		},
		emptyState: {
			noOperations: 'No operations available for this {type}.',
			noManipulatorLimits: 'No manipulator joint limit data available.',
			noJointAngles: 'No joint angle data.',
			noCartesianPose: 'No Cartesian pose data.',
		},
		system: {
			manipulator: 'Manipulator',
			externalAxis: 'External Axis',
			manipulatorJointLimits: 'Manipulator Joint Limits',
			externalAxisJointLimits: 'External Axis Joint Limits',
			tableHeader: {
				joint: 'Joint',
				lowerLimit: 'Lower Limit (°)',
				upperLimit: 'Upper Limit (°)',
				lower: 'Lower Limit',
				upper: 'Upper Limit',
			},
			jointIndex: 'Joint {index}',
			label: {
				name: 'Name',
				serialNo: 'Serial No.',
			},
			button: {
				connect: 'Connect to System',
				connecting: 'Connecting…',
				disconnect: 'Disconnect from System',
				disconnecting: 'Disconnecting…',
			},
			error: {
				connectFailed: 'Failed to connect to system: {message}',
				disconnectFailed: 'Failed to disconnect from system: {message}',
			},
			jog: {
				title: 'Current Position',
				jointSpace: 'Joint Space',
				cartesianSpace: 'Cartesian Space',
				connectHint: 'Connect to the system to read and jog its live position.',
				stubNotice: 'Preview only — jogging the live robot is not yet wired up.',
			},
		},
		sceneObject: {
			title: 'Scene Object',
			mesh: 'Mesh',
			primitive: 'Primitive',
			world: 'World',
			button: {
				filterMesh: 'Filter Mesh',
			},
		},
			pose: {
				title: 'Pose',
				apply: 'Apply Pose',
				applying: 'Applying…',
			},
		target: {
			title: 'Target',
			manipulatorJointAngles: 'Manipulator Joint Angles',
			externalAxisJointAngles: 'External Axis Joint Angles',
			cartesianPose: 'Cartesian Pose (TCP)',
			cartesianPoseBase: 'Cartesian Pose (TCP) — Relative to Base',
			tableHeader: {
				joint: 'Joint',
				angle: 'Angle (°)',
				position: 'Position',
			},
		},
		path: {
			title: 'Toolpath',
			button: {
				rotate: 'Rotate Path Poses about its Z-axis',
					applyChanges: 'Apply Changes',
				applying: 'Applying…',
			},
			},
		area: {
			title: 'Area',
			label: {
				parentObject: 'Parent Object',
			},
		},
		camera: {
			title: 'Camera',
			sectionOptics: 'Camera Parameters',
			label: {
				parent: 'Parent Frame',
				cameraId: 'Camera ID',
				farWidth: 'Far Plane Width (m)',
				farHeight: 'Far Plane Height (m)',
				farDistance: 'Far Plane Distance (m)',
				nearDistance: 'Near Plane Distance (m)',
				depthScale: 'Depth Scale',
			},
		},
	},

	controls: {
		jointSliders: {
			manipulatorJoints: 'Manipulator Joints',
			externalAxisJoints: 'External Axis Joints',
		},
		poseControl: {
			targetFrame: 'Target Frame',
				position: 'Position (m)',
			orientation: 'Orientation (RPY) — degrees',
			nullspace: 'Nullspace — elbow swivel angle (deg)',
			externalAxisSeed: 'External Axis Joint Values',
			label: {
				x: 'X',
				y: 'Y',
				z: 'Z',
				roll: 'Roll',
				pitch: 'Pitch',
				yaw: 'Yaw',
				elbowSwivel: 'Elbow Swivel',
			},
			solving: 'Solving…',
			extJointFallback: 'Ext Joint {index}',
			button: {
				solveIk: 'Solve IK',
			},
		},
	},

	dirBrowser: {
		title: 'Select Folder',
		loading: 'Loading…',
		empty: 'No sub-folders',
		select: 'Select This Folder',
	},

	error: {
		fetchWorkcells: 'Failed to fetch workcells.',
		loadWorkcell: 'Failed to load workcell.',
		createWorkcell: 'Failed to create workcell.',
		deleteWorkcell: 'Failed to delete workcell.',
		loadSceneObjects: 'Failed to load scene objects: {msg}',
		loadSystem: 'Failed to load system "{name}": {msg}',
		httpStatus: 'HTTP {status}',
		loadSystemConfig: 'Failed to load system configuration: {msg}',
		pathExists: 'Path "{name}" already exists on the server. Choose a different name.',
	},

	workflow: {
		meshFilter: {
			title: 'Mesh Filter',
			back: 'Back',
			placeholder: 'Select a filter type…',
			emptyParams: 'No parameters for this filter type.',
			confirmReplace: 'Replace the current object with the filtered mesh?',
			button: {
				filter: 'Filter Mesh',
			},
			label: {
				filterType: 'Filter Type',
				replaceObject: 'Replace current scene object',
			},
			filter: {
				smoothMesh: 'Smooth Mesh',
				largestRegion: 'Largest Region',
				boundingBox: 'Bounding Box',
			},
			param: {
				passBand: 'Pass Band',
				numIterations: 'Number of Iterations',
				bboxCenter: 'Center (X, Y, Z)',
				bboxRPY: 'Orientation (RPY, deg)',
				bboxExtents: 'Extents (X, Y, Z)',
				roll: 'Roll',
				pitch: 'Pitch',
				yaw: 'Yaw',
				enableZBound: 'Enable Z bound',
			},
		},
	},
} as const;

export default en;
export type LocaleMessages = Record<string, any>;
