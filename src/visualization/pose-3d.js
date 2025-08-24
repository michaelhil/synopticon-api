/**
 * 3D Pose Visualization using Three.js
 * Real-time 6DOF head pose rendering with face model
 */

// 3D face model configuration
const FACE_MODEL_CONFIG = {
  scale: 100,
  opacity: 0.8,
  wireframe: false,
  showAxes: true,
  axisLength: 150,
  colors: {
    face: 0x4a90e2,
    wireframe: 0x667eea,
    xAxis: 0xff0000,
    yAxis: 0x00ff00,
    zAxis: 0x0000ff
  }
};

// Create 3D pose visualization
export const createPose3DVisualization = (canvas) => {
  const state = {
    scene: null,
    camera: null,
    renderer: null,
    faceModel: null,
    axesHelper: null,
    animationId: null,
    currentPose: null,
    smoothedPose: null,
    smoothingFactor: 0.7,
    isInitialized: false
  };

  // Initialize Three.js scene
  const initialize = () => {
    try {
      // Create scene
      state.scene = new THREE.Scene();
      state.scene.background = new THREE.Color(0x1a1a1a);

      // Create camera
      state.camera = new THREE.PerspectiveCamera(
        45, 
        canvas.clientWidth / canvas.clientHeight, 
        0.1, 
        1000
      );
      state.camera.position.set(0, 0, 400);
      state.camera.lookAt(0, 0, 0);

      // Create renderer
      state.renderer = new THREE.WebGLRenderer({ 
        canvas,
        antialias: true,
        alpha: true 
      });
      state.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
      state.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      state.renderer.shadowMap.enabled = true;
      state.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Add lighting
      addLighting();

      // Create face model
      createFaceModel();

      // Create coordinate axes
      createAxesHelper();

      // Start render loop
      state.animationId = requestAnimationFrame(render);
      state.isInitialized = true;

      console.log('3D pose visualization initialized');

    } catch (error) {
      console.error('Failed to initialize 3D visualization:', error);
      throw error;
    }
  };

  // Add scene lighting
  const addLighting = () => {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    state.scene.add(ambientLight);

    // Directional light
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(100, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    state.scene.add(directionalLight);

    // Point light for face illumination
    const pointLight = new THREE.PointLight(0x667eea, 0.5, 300);
    pointLight.position.set(0, 50, 100);
    state.scene.add(pointLight);
  };

  // Create 3D face model
  const createFaceModel = () => {
    const group = new THREE.Group();

    // Main face geometry (simplified head)
    const headGeometry = new THREE.SphereGeometry(80, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.7);
    const headMaterial = new THREE.MeshPhongMaterial({
      color: FACE_MODEL_CONFIG.colors.face,
      transparent: true,
      opacity: FACE_MODEL_CONFIG.opacity,
      wireframe: FACE_MODEL_CONFIG.wireframe,
      side: THREE.DoubleSide
    });
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    headMesh.castShadow = true;
    headMesh.receiveShadow = true;
    group.add(headMesh);

    // Nose (small cone)
    const noseGeometry = new THREE.ConeGeometry(8, 25, 8);
    const noseMaterial = new THREE.MeshPhongMaterial({ 
      color: FACE_MODEL_CONFIG.colors.face,
      transparent: true,
      opacity: FACE_MODEL_CONFIG.opacity * 0.9
    });
    const noseMesh = new THREE.Mesh(noseGeometry, noseMaterial);
    noseMesh.position.set(0, -10, 70);
    noseMesh.rotation.x = Math.PI;
    noseMesh.castShadow = true;
    group.add(noseMesh);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(12, 16, 12);
    const eyeMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x333333,
      transparent: true,
      opacity: 0.8
    });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-25, 15, 60);
    leftEye.castShadow = true;
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(25, 15, 60);
    rightEye.castShadow = true;
    group.add(rightEye);

    // Mouth (flattened sphere)
    const mouthGeometry = new THREE.SphereGeometry(15, 16, 8);
    const mouthMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x660000,
      transparent: true,
      opacity: 0.7
    });
    const mouthMesh = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouthMesh.position.set(0, -35, 50);
    mouthMesh.scale.set(1, 0.3, 0.8);
    mouthMesh.castShadow = true;
    group.add(mouthMesh);

    // Add wireframe overlay for better visualization
    if (FACE_MODEL_CONFIG.wireframe) {
      const wireframeGeometry = headGeometry.clone();
      const wireframeMaterial = new THREE.MeshBasicMaterial({
        color: FACE_MODEL_CONFIG.colors.wireframe,
        wireframe: true,
        transparent: true,
        opacity: 0.3
      });
      const wireframeMesh = new THREE.Mesh(wireframeGeometry, wireframeMaterial);
      group.add(wireframeMesh);
    }

    state.faceModel = group;
    state.scene.add(group);
  };

  // Create coordinate axes helper
  const createAxesHelper = () => {
    if (!FACE_MODEL_CONFIG.showAxes) return;

    // Custom axes with labels
    const axesGroup = new THREE.Group();

    // X-axis (Red)
    const xGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(FACE_MODEL_CONFIG.axisLength, 0, 0)
    ]);
    const xMaterial = new THREE.LineBasicMaterial({ color: FACE_MODEL_CONFIG.colors.xAxis });
    const xAxis = new THREE.Line(xGeometry, xMaterial);
    axesGroup.add(xAxis);

    // Y-axis (Green)  
    const yGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, FACE_MODEL_CONFIG.axisLength, 0)
    ]);
    const yMaterial = new THREE.LineBasicMaterial({ color: FACE_MODEL_CONFIG.colors.yAxis });
    const yAxis = new THREE.Line(yGeometry, yMaterial);
    axesGroup.add(yAxis);

    // Z-axis (Blue)
    const zGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, FACE_MODEL_CONFIG.axisLength)
    ]);
    const zMaterial = new THREE.LineBasicMaterial({ color: FACE_MODEL_CONFIG.colors.zAxis });
    const zAxis = new THREE.Line(zGeometry, zMaterial);
    axesGroup.add(zAxis);

    // Add arrow heads
    addArrowHead(axesGroup, FACE_MODEL_CONFIG.axisLength, 0, 0, FACE_MODEL_CONFIG.colors.xAxis);
    addArrowHead(axesGroup, 0, FACE_MODEL_CONFIG.axisLength, 0, FACE_MODEL_CONFIG.colors.yAxis);
    addArrowHead(axesGroup, 0, 0, FACE_MODEL_CONFIG.axisLength, FACE_MODEL_CONFIG.colors.zAxis);

    state.axesHelper = axesGroup;
    state.scene.add(axesGroup);
  };

  // Add arrow head to axis
  const addArrowHead = (group, x, y, z, color) => {
    const arrowGeometry = new THREE.ConeGeometry(5, 15, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({ color });
    const arrowMesh = new THREE.Mesh(arrowGeometry, arrowMaterial);
    
    arrowMesh.position.set(x, y, z);
    
    // Orient arrow head
    if (x > 0) arrowMesh.rotation.z = -Math.PI / 2; // X-axis
    else if (y > 0) arrowMesh.rotation.z = 0;       // Y-axis  
    else if (z > 0) arrowMesh.rotation.x = Math.PI / 2; // Z-axis
    
    group.add(arrowMesh);
  };

  // Update pose visualization
  const updatePose = (pose) => {
    if (!state.isInitialized || !state.faceModel) return;

    state.currentPose = pose;

    // Apply pose smoothing
    if (state.smoothedPose) {
      const alpha = state.smoothingFactor;
      state.smoothedPose = {
        rotation: {
          yaw: lerp(state.smoothedPose.rotation.yaw, pose.rotation.yaw || 0, alpha),
          pitch: lerp(state.smoothedPose.rotation.pitch, pose.rotation.pitch || 0, alpha),
          roll: lerp(state.smoothedPose.rotation.roll, pose.rotation.roll || 0, alpha)
        },
        translation: {
          x: lerp(state.smoothedPose.translation?.x || 0, pose.translation?.x || 0, alpha),
          y: lerp(state.smoothedPose.translation?.y || 0, pose.translation?.y || 0, alpha),
          z: lerp(state.smoothedPose.translation?.z || 0, pose.translation?.z || 0, alpha)
        }
      };
    } else {
      state.smoothedPose = {
        rotation: { ...pose.rotation },
        translation: pose.translation ? { ...pose.translation } : { x: 0, y: 0, z: 0 }
      };
    }

    // Apply rotation to face model
    if (state.smoothedPose.rotation) {
      // Convert from face coordinate system to Three.js coordinate system
      state.faceModel.rotation.x = -(state.smoothedPose.rotation.pitch || 0);
      state.faceModel.rotation.y = state.smoothedPose.rotation.yaw || 0;
      state.faceModel.rotation.z = -(state.smoothedPose.rotation.roll || 0);
    }

    // Apply translation
    if (state.smoothedPose.translation) {
      state.faceModel.position.x = (state.smoothedPose.translation.x || 0) * 0.5;
      state.faceModel.position.y = -(state.smoothedPose.translation.y || 0) * 0.5;
      state.faceModel.position.z = (state.smoothedPose.translation.z || 0) * 0.5;
    }

    // Update axes helper to match face model
    if (state.axesHelper) {
      state.axesHelper.rotation.copy(state.faceModel.rotation);
      state.axesHelper.position.copy(state.faceModel.position);
    }
  };

  // Linear interpolation helper
  const lerp = (a, b, alpha) => {
    return a + (b - a) * alpha;
  };

  // Render loop
  const render = () => {
    if (!state.isInitialized) return;

    try {
      // Auto-rotate scene slightly for better depth perception
      if (!state.currentPose) {
        state.camera.position.x = Math.sin(Date.now() * 0.001) * 50;
        state.camera.lookAt(0, 0, 0);
      }

      state.renderer.render(state.scene, state.camera);
      state.animationId = requestAnimationFrame(render);

    } catch (error) {
      console.error('Render error:', error);
    }
  };

  // Handle canvas resize
  const resize = () => {
    if (!state.isInitialized) return;

    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    state.camera.aspect = width / height;
    state.camera.updateProjectionMatrix();
    state.renderer.setSize(width, height);
  };

  // Cleanup resources
  const cleanup = () => {
    if (state.animationId) {
      cancelAnimationFrame(state.animationId);
    }

    if (state.renderer) {
      state.renderer.dispose();
    }

    if (state.scene) {
      // Dispose of all geometries and materials
      state.scene.traverse((object) => {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(material => material.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
    }

    state.isInitialized = false;
    console.log('3D pose visualization cleaned up');
  };

  // Set visualization options
  const setOptions = (options = {}) => {
    if (options.smoothingFactor !== undefined) {
      state.smoothingFactor = Math.max(0, Math.min(1, options.smoothingFactor));
    }

    if (options.showAxes !== undefined && state.axesHelper) {
      state.axesHelper.visible = options.showAxes;
    }

    if (options.wireframe !== undefined && state.faceModel) {
      state.faceModel.traverse((child) => {
        if (child.material && child.material.wireframe !== undefined) {
          child.material.wireframe = options.wireframe;
        }
      });
    }

    if (options.opacity !== undefined && state.faceModel) {
      state.faceModel.traverse((child) => {
        if (child.material && child.material.transparent) {
          child.material.opacity = options.opacity;
        }
      });
    }
  };

  // Get current pose
  const getCurrentPose = () => {
    return state.currentPose;
  };

  // Get smoothed pose
  const getSmoothedPose = () => {
    return state.smoothedPose;
  };

  // Initialize and return public interface
  initialize();

  // Setup resize observer with cleanup
  let resizeObserver = null;
  let resizeController = null;
  
  if (window.ResizeObserver) {
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);
  } else {
    resizeController = new AbortController();
    window.addEventListener('resize', resize, { signal: resizeController.signal });
  }

  return {
    updatePose,
    setOptions,
    getCurrentPose,
    getSmoothedPose,
    resize,
    cleanup: () => {
      // Clean up event listeners
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (resizeController) {
        resizeController.abort();
      }
      cleanup();
    },
    
    // Advanced methods
    getScene: () => state.scene,
    getCamera: () => state.camera,
    getRenderer: () => state.renderer,
    getFaceModel: () => state.faceModel,
    
    // State queries
    isInitialized: () => state.isInitialized
  };
};

// Create pose comparison visualization
export const createPoseComparisonVisualization = (canvas, poses = []) => {
  const state = {
    scene: null,
    camera: null,
    renderer: null,
    faceModels: [],
    isInitialized: false
  };

  const initialize = () => {
    // Similar to main visualization but with multiple face models
    state.scene = new THREE.Scene();
    state.scene.background = new THREE.Color(0x1a1a1a);

    state.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    state.camera.position.set(0, 0, 600);

    state.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    state.renderer.setSize(canvas.clientWidth, canvas.clientHeight);

    // Create multiple face models for comparison
    poses.forEach((_, index) => {
      const faceModel = createComparisonFaceModel(index);
      faceModel.position.x = (index - poses.length / 2) * 200;
      state.faceModels.push(faceModel);
      state.scene.add(faceModel);
    });

    state.isInitialized = true;
    render();
  };

  const createComparisonFaceModel = (index) => {
    // Simplified face model for comparison
    const group = new THREE.Group();
    
    const geometry = new THREE.SphereGeometry(60, 16, 12);
    const material = new THREE.MeshBasicMaterial({
      color: [0xff0000, 0x00ff00, 0x0000ff, 0xffff00][index % 4],
      wireframe: true,
      opacity: 0.7,
      transparent: true
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    group.add(mesh);
    
    return group;
  };

  const updatePoses = (newPoses) => {
    newPoses.forEach((pose, index) => {
      if (state.faceModels[index] && pose) {
        state.faceModels[index].rotation.x = -(pose.rotation?.pitch || 0);
        state.faceModels[index].rotation.y = pose.rotation?.yaw || 0;
        state.faceModels[index].rotation.z = -(pose.rotation?.roll || 0);
      }
    });
  };

  const render = () => {
    if (state.isInitialized) {
      state.renderer.render(state.scene, state.camera);
      requestAnimationFrame(render);
    }
  };

  initialize();

  return {
    updatePoses,
    cleanup: () => { state.isInitialized = false; }
  };
};

// Export utilities
export const pose3DUtils = {
  convertPoseToThreeJS: (pose) => ({
    rotation: {
      x: -(pose.rotation?.pitch || 0),
      y: pose.rotation?.yaw || 0,
      z: -(pose.rotation?.roll || 0)
    },
    position: {
      x: (pose.translation?.x || 0) * 0.5,
      y: -(pose.translation?.y || 0) * 0.5,
      z: (pose.translation?.z || 0) * 0.5
    }
  }),

  createCustomFaceModel: (geometry, material) => {
    return new THREE.Mesh(geometry, material);
  },

  addLandmarkVisualization: (scene, landmarks, color = 0x00ff00) => {
    const group = new THREE.Group();
    
    landmarks.forEach(point => {
      const geometry = new THREE.SphereGeometry(2, 8, 6);
      const material = new THREE.MeshBasicMaterial({ color });
      const sphere = new THREE.Mesh(geometry, material);
      
      sphere.position.set(point.x, point.y, point.z);
      group.add(sphere);
    });
    
    scene.add(group);
    return group;
  }
};