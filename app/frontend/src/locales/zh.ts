/**
 * Chinese (Simplified) locale messages for composer_studio.
 *
 * Key convention: `section.subsection.key`
 * Interpolation: `{placeholder}` tokens resolved by t('key', { placeholder: 'value' })
 */
const zh = {
	app: {
		title: '非夕 Composer Studio',
		workcellRoot: 'PDK 发布文件夹：',
		enterFullscreen: '进入全屏',
		exitFullscreen: '退出全屏',
		nav: {
			workcellSetup: '工作单元设置',
			liveSceneEventsOn: '实时场景事件：开启',
			liveSceneEventsOff: '实时场景事件：关闭',
			liveSceneEventsConfirm: '开启实时场景事件后，场景将与服务器的任何事件保持主动同步。开启期间，所有 UI 场景交互都将被禁用。',
		},
		loading: '正在加载系统配置…',
		tabs: {
			moreSetup: '更多设置',
		},
		panel: {
			backToNavigator: '场景导航器',
		},
	},

	dialog: {
		confirm: {
			cancel: '取消',
			ok: '确定',
			yes: '是',
			no: '否',
		},
		invalidRoot: {
			title: 'Nebula 发布文件夹未找到',
			message: '路径 "{path}" 不存在。请指定有效的 Nebula 发布文件夹以继续。',
			apply: '应用',
		},
		workcell: {
			title: '工作单元设置',
			newTitle: '新工作单元',
			loading: '正在加载工作单元…',
			empty: '未找到工作单元。',
			noDescription: '此工作单元无描述信息。',
			label: {
				available: '可用工作单元',
				name: '名称',
				description: '描述',
			},
			placeholder: {
				select: '选择工作单元...',
				name: '输入工作单元名称',
				description: '可选描述',
			},
			button: {
				cancel: '取消',
				new: '新建',
				delete: '删除',
				deleting: '正在删除…',
				load: '加载',
				loading: '正在加载…',
				create: '创建',
				creating: '正在创建…',
			},
			description: '描述',
			confirmDelete: '确认删除工作单元 "{name}"？此操作无法撤销。',
		},
	},

	setup: {
		trajectory: {
			title: '设置轨迹',
			titlePtp: '设置 PTP 轨迹',
			titleLinear: '设置直线路径轨迹',
			label: {
				name: '名称',
				normalOffset: '法向偏移',
				elbowSwivelAngle: '肘部回旋角（度）',
				externalAxisPosition: '外部轴位置（度）',
			},
			placeholder: {
				name: '输入轨迹名称',
			},
			button: {
				create: '创建轨迹',
				solving: '正在求解…',
			},
			tab: {
				fromTargets: '从目标生成',
				fromPath: '选择轨迹生成路径',
			},
			transfer: {
				available: '可用目标',
				selected: '轨迹目标',
				empty: '无',
				loading: '正在加载…',
			},
			motionProfile: {
				title: '运动参数',
				velocity: '速度',
				acceleration: '加速度',
			},
			collisionConfig: {
				title: '碰撞配置',
				collisionMargin: '碰撞间隙',
			},
			saveError: '保存轨迹失败:',
		},
		target: {
			title: '设置目标 / 轨迹',
			label: {
				name: '名称',
			},
			placeholder: {
				name: '输入目标名称',
			},
			button: {
				create: '创建目标',
				tcpDrag: 'TCP 拖动',
				stopTcpDrag: '停止 TCP 拖动',
			},
			tab: {
				jointSpace: '关节空间',
				cartesianSpace: '笛卡尔空间',
			},
			saveError: '保存目标失败:',
			duplicateName: '名为 "{name}" 的目标已存在。',
			collisionWarning: '此关节配置存在碰撞或无法到达。',
			collisionCheckError: '碰撞检查失败：{message}',
		},
		area: {
			title: '设置区域',
			label: {
				parent: '父级',
				name: '名称',
			},
			placeholder: {
				name: '输入区域名称',
			},
			button: {
				create: '创建区域',
				extracting: '提取区域中...',
				clearPoints: '清除点',
			},
			tab: {
				freeDraw: '自由绘制',
				generateFromMesh: '从网格生成',
			},
			hint: {
				clickObject: '在可视化窗口中双击物体以放置区域点。',
			},
			error: {
				notEnoughPoints: '请在物体上放置至少 3 个点以创建区域。',
				createFailed: '无法创建区域：{message}',
			},
		},
		path: {
			title: '设置路径',
			label: {
				sceneObject: '场景物体',
				name: '名称',
				pointSpacing: '点间距 (m)',
				blendingRadius: '平滑半径 (m)',
				area: '区域',
				fixedSpacing: '固定间距 (m)',
				borderOffset: '边界偏移 (m)',
				rasterLineSpacing: '光栅线间距 (m)',
				rasterJoiningThreshold: '连接阈值 (m)',
				rasterDirection: '光栅方向',
				principalAngle: '主方向角',
				specifiedDirection: '指定方向',
				principalRotationAngle: '旋转角度 (deg)',
				rasterFlip: '翻转起始方向',
				orientationAlignment: '朝向对齐',
				alignWithInitialDirection: '与初始方向对齐',
				alignWithPrevious: '与前一路径点对齐',
				alignWithDirection: '与世界坐标系方向对齐',
			},
			placeholder: {
				name: '输入路径名称',
				selectArea: '选择区域',
				noAreas: '暂无可用区域',
			},
			tab: {
				freeSketch: '自由绘制',
				generateFromArea: '从区域生成',
			},
			subTab: {
				parameters: '参数',
				orientationAlignment: '朝向',
			},
			hint: {
				clickObject: '在可视化窗口中双击物体以指定路径点。',
				generatePlaceholder: '从区域生成的选项将在此处显示。',
			},
			error: {
				notEnoughWaypoints: '请在物体上放置至少 2 个路径点以创建路径。',
				createFailed: '无法创建路径：{message}',
			},
			button: {
				create: '创建路径',
				creating: '正在创建路径...',
				clearWaypoints: '清除路径点',
				generate: '生成路径',
				visualizeToolpath: '可视化刀路',
			},
		},
		sceneObject: {
			title: '设置场景物体',
			label: {
				name: '名称',
				parent: '父级',
				requiredMtl: '需要的 .mtl 文件',
				shape: '形状',
				sizeX: '尺寸 X (m)',
				sizeY: '尺寸 Y (m)',
				sizeZ: '尺寸 Z (m)',
				pose: '位姿',
			},
			placeholder: {
				name: '输入场景物体名称',
			},
			option: {
				world: 'world',
			},
			tab: {
				mesh: '网格',
				primitives: '基本形状',
			},
			status: {
				noFile: '未选择文件',
				required: '需要: {filename}',
				uploading: '正在上传…',
				inserting: '正在插入…',
			},
			shape: {
				box: '长方体',
			},
			button: {
				selectObj: '选择 .obj 文件',
				selectMtl: '选择 .mtl 文件',
				insertMesh: '插入',
				insertBox: '插入',
			},
		},
		system: {
			editTitle: '编辑系统',
			createTitle: '设置系统',
			label: {
				systemName: '系统名称',
				name: '名称',
				armSerial: '机械臂序列号',
				controlBoxSerial: '控制箱序列号',
				manufacturer: '制造商',
				model: '型号',
				poseTitle: '位姿',
				x: 'X (m)',
				y: 'Y (m)',
				z: 'Z (m)',
				roll: 'Roll (deg)',
				pitch: 'Pitch (deg)',
				yaw: 'Yaw (deg)',
			},
			placeholder: {
				name: '例如: my_robot',
				manipulator: '例如: my_manipulator',
				armSerial: '例如: A02L-00-M3-000001',
				controlBoxSerial: '例如: CX01-01-T1-000001',
				extAxisName: '例如: linear_rail_1',
				toolAdapter: '例如: sander_adapter',
				tool: '例如: sander',
				selectManufacturer: '-- 选择制造商 --',
				selectModel: '-- 选择型号 --',
			},
			tab: {
				manipulator: '机械臂',
				externalAxis: '外部轴',
				tool: '工具',
				mounting: '安装',
			},
			subTab: {
				toolAdapter: '工具适配器',
				tool: '工具',
				systemMount: '系统安装座',
				manipulatorMount: '机械臂安装座',
			},
			hint: {
				systemMount: '系统安装座在世界坐标系中的位置和方向。',
				manipulatorMount: '机械臂适配器相对于系统安装座的位置和方向...',
			},
			feedback: {
				modifying: '正在修改…',
				creating: '正在创建…',
				deleting: '正在删除…',
				syncing: '正在同步…',
				loadingAxes: '正在加载可用的外部轴…',
				noAxes: '服务器上没有可用的外部轴。',
				loadingAdapters: '正在加载可用的工具适配器…',
				noAdapters: '服务器上没有可用的工具适配器。',
				loadingTools: '正在加载可用的工具…',
				noTools: '服务器上没有可用的工具。',
			},
			error: {
				nameRequired: '请先指定系统名称。',
				duplicateName: '名为"{name}"的系统已存在。',
				missingRequired: '请填写必填字段：{fields}。',
			},
			prompt: {
				serialNumber: '请指定机器人的公开序列号。',
				serialNumberPlaceholder: '公开序列号',
			},
			button: {
				modify: '修改系统',
				create: '创建系统',
				delete: '删除系统',
				sync: '从控制器同步',
			},
		},

		camera: {
			editTitle: '编辑相机',
			createTitle: '设置相机',
			label: {
				name: '名称',
				parent: '父坐标系',
				poseTitle: '位姿',
				cameraId: '相机 ID',
				farWidth: '远平面宽度 (m)',
				farHeight: '远平面高度 (m)',
				farDistance: '远平面距离 (m)',
				nearDistance: '近平面距离 (m)',
				depthScale: '深度缩放',
				syncFromDevice: '从相机设备同步远平面宽度 / 高度',
			},
			placeholder: {
				name: '例如: my_camera',
			},
			option: {
				world: 'world',
			},
			hint: {
				optics: '视锥体和深度参数。',
			},
			feedback: {
				modifying: '正在修改…',
				creating: '正在创建…',
				deleting: '正在删除…',
				syncingFromDevice: '正在从设备同步…',
			},
			error: {
				duplicateName: '名为"{name}"的相机已存在。',
				missingRequired: '请填写必填字段：{fields}。',
			},
			warning: {
				deviceNotOnline: '相机 "{name}" 不在线 — 无法同步远平面宽度 / 高度。',
			},
			button: {
				modify: '修改相机',
				create: '创建相机',
				delete: '删除相机',
			},
		},

		customComponents: {
			title: '自定义工具适配器 / 工具',
			tab: {
				toolAdapter: '工具适配器',
				tool: '工具',
			},
			feedback: {
				loadingCustomToolAdapters: '正在加载自定义工具适配器…',
				noCustomToolAdapters: '暂无可用的自定义工具适配器。',
				loadingCustomTools: '正在加载自定义工具…',
				noCustomTools: '暂无可用的自定义工具。',
				saving: '正在保存…',
				saved: '工具适配器已保存。',
				savedTool: '工具已保存。',
				removedToolAdapter: '工具适配器已删除。',
				removedTool: '工具已删除。',
			},
			tableHeader: {
				manufacturer: '制造商',
				model: '型号',
			},
			label: {
				manufacturer: '制造商',
				model: '型号',
				flangePoses: '法兰位姿',
				tcpPose: 'TCP 位姿',
				visualMesh: '视觉网格',
				collisionMesh: '碰撞网格',
				preview: '预览',
			},
			placeholder: {
				manufacturer: '例如 Flexiv',
				model: '例如 sander_adapter',
			},
			button: {
				addToolAdapter: '添加工具适配器',
				addTool: '添加工具',
				addFlange: '添加法兰',
				removeFlange: '删除法兰',
				selectFile: '选择文件',
				save: '保存',
				cancel: '取消',
				remove: '删除',
			},
			status: {
				noFile: '未选择文件',
			},
			confirm: {
				removeToolAdapter: '删除工具适配器 "{model}"？',
				removeTool: '删除工具 "{model}"？',
			},
			warning: {
				toolAdapterInUse: '工具适配器 "{model}" 目前正被以下系统使用：{systems}。仍要删除吗？',
				toolInUse: '工具 "{model}" 目前正被以下系统使用：{systems}。仍要删除吗？',
			},
			error: {
				missingRequired: '请指定制造商和型号。',
			},
		},

		collisionConfig: {
			title: '碰撞配置',
			notice: '目前只有名为 "default" 的配置会被 IK 检测和 PTP 运动规划使用。其他配置虽已保存，但在其他地方被启用之前不会生效。',
			tableHeader: {
				name: '名称',
				margin: '安全裕度 (m)',
				pairs: '排除配对',
			},
			label: {
				name: '名称',
				margin: '碰撞安全裕度 (m)',
				pairs: '排除的碰撞配对',
				pairName1: '组件 1',
				pairName2: '组件 2',
				activeBadge: '生效中',
			},
			placeholder: {
				name: '输入配置名称',
			},
			button: {
				create: '创建配置',
				rename: '重命名',
				delete: '删除',
				save: '保存',
				cancel: '取消',
				select: '编辑',
				addPair: '添加配对',
				removePair: '移除',
			},
			feedback: {
				loading: '正在加载碰撞配置…',
				noConfigs: '暂无已保存的碰撞配置。',
				saving: '正在保存…',
				created: '已创建碰撞配置。',
				renamed: '已重命名碰撞配置。',
				removed: '已删除碰撞配置。',
				marginSaved: '已保存碰撞安全裕度。',
				pairAdded: '已添加配对。',
				pairRemoved: '已移除配对。',
				noPairs: '暂无排除配对。',
			},
			confirm: {
				rename: '重命名碰撞配置 "{name}"？',
				renameDefault: '警告："{name}" 是 IK 检测和 PTP 运动规划实际使用的碰撞配置。重命名后，这些检测将回退到一个空的、未命名的默认配置。是否继续？',
				remove: '删除碰撞配置 "{name}"？',
				removeDefault: '警告："{name}" 是 IK 检测和 PTP 运动规划实际使用的碰撞配置。删除后，当前生效的安全裕度和排除配对设置都会丢失。是否继续？',
			},
			error: {
				missingName: '请输入名称。',
			},
		},

		license: {
			title: '许可证管理',
			tabs: {
				status: '状态',
				install: '安装许可证',
			},
			label: {
				deviceIdentifier: '设备标识符',
				hardwareVerifiable: '硬件可验证',
				tpmAvailable: '安全芯片 (TPM)',
				tpmDetail: 'TPM 详情',
				warnings: '警告',
				licenseFile: '许可证文件',
			},
			tableHeader: {
				expires: '到期时间',
				licenseId: '许可证 ID',
				customer: '客户',
				issued: '签发时间',
				services: '授权服务',
				hardwareVerified: '硬件已验证',
				notes: '备注',
			},
			value: {
				never: '永不过期',
				yes: '是',
				no: '否',
			},
			placeholder: {
				noFileSelected: '未选择文件。',
			},
			button: {
				refresh: '刷新',
				chooseFile: '选择文件',
				install: '安装许可证',
				export: '导出',
			},
			feedback: {
				loading: '正在加载许可证状态…',
				exported: '已保存 license_identifier.txt。',
				saving: '正在安装…',
				installSuccess: '许可证已安装。新授权服务：{services}',
				installSuccessNone: '许可证已安装。',
				noLicenses: '此计算机上未安装任何许可证。',
				noWarnings: '',
			},
			error: {
				missingRequired: '请选择许可证文件。',
			},
		},
	},

	tree: {
		category: {
			systems: '系统',
			sceneObjects: '场景物体',
			cameras: '相机',
			areas: '区域',
			paths: '路径',
			targets: '目标',
			ptpTrajectories: 'PTP 轨迹',
			linearTrajectories: '直线路径轨迹',
			collisionConfigs: '碰撞配置',
			customComponents: '自定义组件',
			license: '许可证管理',
		},
		empty: {
			systems: '无系统已加载',
			sceneObjects: '无场景物体已加载',
			cameras: '无相机已加载',
			areas: '无区域已加载',
			paths: '无路径已加载',
			targets: '无目标已加载',
			ptpTrajectories: '无 PTP 轨迹',
			linearTrajectories: '无直线路径轨迹',
		},
		action: {
			addArea: '添加区域',
			addPath: '添加路径',
			addTarget: '添加目标轨迹',
			addPtpTrajectory: '添加 PTP 轨迹',
			addLinearTrajectory: '添加直线路径轨迹',
			remove: '移除',
			editRemove: '编辑 / 移除',
		},
		confirm: {
			removeSceneObject: '确认移除场景物体 "{name}"？',
			removeCamera: '确认移除相机 "{name}"？',
			removeItem: '确认移除项目 "{name}"？',
			removePath: '确认移除路径 "{name}"？',
			removeTarget: '确认移除目标 "{name}"？',
			removeArea: '确认移除区域 "{name}"？',
			removeTrajectory: '确认移除轨迹 "{name}"？',
		},
	},

	info: {
		loading: '正在加载…',
		empty: '选择一个系统、场景物体或路径以查看详情。',
		trajectory: {
			type: '类型',
			system: '系统',
			ptp: '点到点',
			linear: '线性',
		},
		ptpTrajectory: {
			title: '点到点轨迹',
			label: {
				playback: '播放进度',
			},
			button: {
				visualize: '可视化轨迹',
				loading: '加载中…',
				stop: '停止',
			},
		},
		linearTrajectory: {
			title: '直线路径轨迹',
			label: {
				tcp: 'TCP',
				normalOffset: '法向偏移',
				waypointCount: '路径点数',
				pathForceMoment: '路径力/力矩',
				pathMotion: '路径运动',
				velocity: '速度',
				acceleration: '加速度',
				playback: '播放进度',
			},
			tableHeader: {
				index: '#',
				velocity: '速度 (m/s)',
				acceleration: '加速度 (m/s²)',
				force: '力 (N)',
				moment: '力矩 (Nm)',
			},
			button: {
				visualize: '可视化轨迹',
				loading: '加载中…',
				stop: '停止',
			},
		},
		tab: {
			information: '信息',
			setup: '设置',
			position: '位置',
			operations: '操作',
		},
		label: {
			name: '名称',
			type: '类型',
			dof: '自由度',
			system: '系统',
			tcp: 'TCP',
			position: '位置',
			orientation: '方向',
			parent: '父级',
		},
		emptyState: {
			noOperations: '此{type}没有可用的操作。',
			noManipulatorLimits: '无机械臂关节限制数据。',
			noJointAngles: '无关节角度数据。',
			noCartesianPose: '无笛卡尔位姿数据。',
		},
		system: {
			manipulator: '机械臂',
			externalAxis: '外部轴',
			manipulatorJointLimits: '机械臂关节限制',
			externalAxisJointLimits: '外部轴关节限制',
			tableHeader: {
				joint: '关节',
				lowerLimit: '下限 (°)',
				upperLimit: '上限 (°)',
				lower: '下限',
				upper: '上限',
			},
			jointIndex: '关节 {index}',
			label: {
				name: '名称',
				serialNo: '序列号',
			},
			button: {
				connect: '连接系统',
				connecting: '正在连接…',
				disconnect: '断开系统连接',
				disconnecting: '正在断开…',
			},
			error: {
				connectFailed: '连接系统失败：{message}',
				disconnectFailed: '断开系统连接失败：{message}',
			},
			jog: {
				title: '当前位置',
				jointSpace: '关节空间',
				cartesianSpace: '笛卡尔空间',
				connectHint: '连接系统后可读取并微调其实时位置。',
				stubNotice: '仅预览 — 尚未接入实体机器人微调。',
			},
		},
		sceneObject: {
			title: '场景物体',
			mesh: '网格',
			primitive: '基本体',
			world: '世界',
			button: {
				filterMesh: '过滤网格',
			},
		},
			pose: {
				title: '位姿',
				apply: '应用位姿',
				applying: '应用中…',
			},
		target: {
			title: '目标',
			manipulatorJointAngles: '机械臂关节角度',
			externalAxisJointAngles: '外部轴关节角度',
			cartesianPose: '笛卡尔位姿 (TCP)',
			cartesianPoseBase: '笛卡尔位姿 (TCP) — 相对于基座',
			tableHeader: {
				joint: '关节',
				angle: '角度 (°)',
				position: '位置',
			},
		},
		path: {
			title: '工具路径',
			button: {
				rotate: '绕 Z 轴旋转路径位姿',
					applyChanges: '应用更改',
				applying: '应用中…',
			},
			},
		area: {
			title: '区域',
			label: {
				parentObject: '父物体',
			},
		},
		camera: {
			title: '相机',
			sectionOptics: '相机参数',
			label: {
				parent: '父坐标系',
				cameraId: '相机 ID',
				farWidth: '远平面宽度 (m)',
				farHeight: '远平面高度 (m)',
				farDistance: '远平面距离 (m)',
				nearDistance: '近平面距离 (m)',
				depthScale: '深度缩放',
			},
		},
	},

	controls: {
		jointSliders: {
			manipulatorJoints: '机械臂关节',
			externalAxisJoints: '外部轴关节',
		},
		poseControl: {
			targetFrame: '目标坐标系',
				position: '位置 (m)',
			orientation: '方向 (RPY) — 度',
			nullspace: '零空间 — 肘关节旋转角 (deg)',
			externalAxisSeed: '外部轴关节值 (IK 初始值)',
			label: {
				x: 'X',
				y: 'Y',
				z: 'Z',
				roll: 'Roll',
				pitch: 'Pitch',
				yaw: 'Yaw',
				elbowSwivel: '肘关节旋转',
			},
			solving: '正在求解…',
			extJointFallback: '外部关节 {index}',
			button: {
				solveIk: '求解 IK',
			},
		},
	},

	dirBrowser: {
		title: '选择文件夹',
		loading: '正在加载…',
		empty: '无子文件夹',
		select: '选择此文件夹',
	},

	error: {
		fetchWorkcells: '获取工作单元失败。',
		loadWorkcell: '加载工作单元失败。',
		createWorkcell: '创建工作单元失败。',
		deleteWorkcell: '删除工作单元失败。',
		loadSceneObjects: '加载场景物体失败: {msg}',
		loadSystem: '加载系统 "{name}" 失败: {msg}',
		httpStatus: 'HTTP {status}',
		loadSystemConfig: '加载系统配置失败: {msg}',
		pathExists: '路径 "{name}" 已存在于服务器上。请选择不同的名称。',
	},

	workflow: {
		meshFilter: {
			title: '网格过滤',
			back: '返回',
			placeholder: '选择过滤类型…',
			emptyParams: '此过滤类型没有参数。',
			confirmReplace: '是否用过滤后的网格替换当前物体？',
			button: {
				filter: '过滤网格',
			},
			label: {
				filterType: '过滤类型',
				replaceObject: '替换当前场景物体',
			},
			filter: {
				smoothMesh: '平滑网格',
				largestRegion: '最大区域',
				boundingBox: '包围盒',
			},
			param: {
				passBand: '通带',
				numIterations: '迭代次数',
				bboxCenter: '中心点 (X, Y, Z)',
				bboxRPY: '方向 (RPY, 度)',
				bboxExtents: '范围 (X, Y, Z)',
				roll: '翻滚',
				pitch: '俯仰',
				yaw: '偏航',
				enableZBound: '启用 Z 轴边界',
			},
		},
	},
} as const;

export default zh;
