declare module '@mkkellogg/gaussian-splats-3d' {
  export const SceneFormat: {
    Ply: number;
    Splat: number;
    KSplat: number;
    Spz: number;
  };

  export const SceneRevealMode: {
    Default: number;
    Gradual: number;
    Instant: number;
  };

  export const RenderMode: {
    Always: number;
    OnChange: number;
    Never: number;
  };

  export const LogLevel: {
    None: number;
    Info: number;
    Warn: number;
    Error: number;
  };

  export interface ViewerOptions {
    rootElement?: HTMLElement;
    cameraUp?: [number, number, number];
    initialCameraPosition?: [number, number, number];
    initialCameraLookAt?: [number, number, number];
    sharedMemoryForWorkers?: boolean;
    gpuAcceleratedSort?: boolean;
    enableSIMDInSort?: boolean;
    sceneRevealMode?: number;
    renderMode?: number;
    logLevel?: number;
  }

  export interface AddSplatSceneOptions {
    format?: number;
    showLoadingUI?: boolean;
    progressiveLoad?: boolean;
    splatAlphaRemovalThreshold?: number;
  }

  export class Viewer {
    constructor(options?: ViewerOptions);
    addSplatScene(path: string, options?: AddSplatSceneOptions): Promise<void>;
    start(): void;
    stop(): void;
    dispose(): Promise<void>;
  }
}

