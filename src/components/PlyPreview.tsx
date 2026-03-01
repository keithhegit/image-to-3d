// PLY 3D模型预览组件（Gaussian Splat 渲染）
import { useEffect, useMemo, useRef, useState } from 'react';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { ArrowLeft, Loader2, HelpCircle } from 'lucide-react';

interface PlyPreviewProps {
  plyData: ArrayBuffer;
  fileName: string;
  onBack: () => void;
}

interface ParsedPlyHeader {
  format: string;
  vertexCount: number;
  properties: string[];
  hasFdcColor: boolean;
}

function parsePlyHeader(plyData: ArrayBuffer): ParsedPlyHeader {
  const decoder = new TextDecoder('utf-8');
  const headerProbeLength = Math.min(256 * 1024, plyData.byteLength);
  const headerText = decoder.decode(plyData.slice(0, headerProbeLength));
  const endHeaderIndex = headerText.indexOf('end_header');

  if (endHeaderIndex < 0) {
    throw new Error('无法读取 PLY 文件头（未找到 end_header）');
  }

  const header = headerText.slice(0, endHeaderIndex);
  const lines = header.split(/\r?\n/).map((line) => line.trim());
  const properties = lines
    .filter((line) => line.startsWith('property '))
    .map((line) => line.replace(/^property\s+/, ''));

  const formatLine = lines.find((line) => line.startsWith('format '));
  const vertexLine = lines.find((line) => line.startsWith('element vertex '));
  const vertexCount = vertexLine ? Number(vertexLine.split(/\s+/)[2]) : 0;
  const hasFdcColor = ['float f_dc_0', 'float f_dc_1', 'float f_dc_2'].every((item) => properties.includes(item));

  return {
    format: formatLine ?? 'format unknown',
    vertexCount,
    properties,
    hasFdcColor,
  };
}

// 新手引导层
function TutorialOverlay({ onClose }: { onClose: () => void }) {
  return (
    <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center cursor-pointer" onClick={onClose}>
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 max-w-sm text-center text-white animate-in fade-in zoom-in duration-300 shadow-2xl">
        <h3 className="text-2xl font-bold mb-8">操作指南</h3>
        <div className="space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">👆</div>
            <div className="text-left">
              <p className="font-bold text-lg">单指拖动</p>
              <p className="text-sm text-gray-300">旋转模型视角</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">✌️</div>
            <div className="text-left">
              <p className="font-bold text-lg">双指捏合 / 滚轮</p>
              <p className="text-sm text-gray-300">缩放模型大小</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center text-3xl">✋</div>
            <div className="text-left">
              <p className="font-bold text-lg">双指/右键拖动</p>
              <p className="text-sm text-gray-300">平移模型位置</p>
            </div>
          </div>
        </div>
        <button 
          className="mt-10 w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-xl font-bold text-lg transition-colors shadow-lg"
          onClick={(e) => { e.stopPropagation(); onClose(); }}
        >
          开始预览
        </button>
      </div>
    </div>
  );
}

// 加载状态组件
function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#1a1a2e]">
      <Loader2 className="w-12 h-12 text-purple-500 animate-spin mb-4" />
      <p className="text-gray-400">加载 3D 模型中...</p>
    </div>
  );
}

export function PlyPreview({ plyData, fileName, onBack }: PlyPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTutorial, setShowTutorial] = useState(true);
  const parsedHeader = useMemo(() => {
    try {
      return parsePlyHeader(plyData);
    } catch {
      return null;
    }
  }, [plyData]);
  const [modelInfo, setModelInfo] = useState<{
    vertexCount: number;
    hasFdcColor: boolean;
    format: string;
  } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (!parsedHeader) return;

    let isUnmounted = false;
    const objectUrl = URL.createObjectURL(new Blob([plyData], { type: 'application/octet-stream' }));

    const viewer = new GaussianSplats3D.Viewer({
      rootElement: container,
      cameraUp: [0, -1, 0], // 调整为更标准的垂直向上 (Y轴负向适配模型坐标系)
      initialCameraPosition: [0, 2, -3], // 调整相机位置到背面 (假设原位置 Z=6 是背面，尝试 Z=-3 且更近以放大)
      initialCameraLookAt: [0, 0, 0], // 看向原点
      // 禁用 SharedArrayBuffer，避免本地开发时 cross-origin isolation 要求导致渲染失败。
      sharedMemoryForWorkers: false,
      gpuAcceleratedSort: false,
      enableSIMDInSort: true,
      splatAlphaRemovalThreshold: 1,
      sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
      renderMode: GaussianSplats3D.RenderMode.Always,
      logLevel: GaussianSplats3D.LogLevel.None,
    });

    setIsLoading(true);
    setError(null);

    try {
      if (parsedHeader) {
        setModelInfo({
          vertexCount: parsedHeader.vertexCount,
          hasFdcColor: parsedHeader.hasFdcColor,
          format: parsedHeader.format,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    }

    viewer.addSplatScene(objectUrl, {
      format: GaussianSplats3D.SceneFormat.Ply,
      showLoadingUI: true,
      progressiveLoad: false,
      splatAlphaRemovalThreshold: 1,
    }).then(() => {
      if (isUnmounted) return;
      viewer.start();
      setIsLoading(false);
    }).catch((err: unknown) => {
      if (isUnmounted) return;
      setError((err as Error).message);
      setIsLoading(false);
    });

    return () => {
      isUnmounted = true;
      URL.revokeObjectURL(objectUrl);
      void viewer.dispose();
    };
  }, [parsedHeader, plyData]);

  useEffect(() => {
    if (!parsedHeader) {
      setError('PLY 文件头解析失败，无法进行预览');
      setIsLoading(false);
    }
  }, [parsedHeader]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-md p-8 max-w-md text-center">
          <p className="text-red-600 mb-4">加载失败：{error}</p>
          <button
            onClick={onBack}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 mx-auto"
          >
            <ArrowLeft className="w-5 h-5" />
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#1a1a2e] flex flex-col">
      {/* 顶部栏 */}
      <div className="bg-gray-800/80 backdrop-blur border-b border-gray-700 px-6 py-4 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>返回</span>
          </button>
          <div className="flex items-center gap-4">
             <div className="text-white font-medium truncate max-w-xs sm:max-w-md">
              {fileName}
            </div>
            <button 
              onClick={() => setShowTutorial(true)}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
              title="操作指南"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          </div>
          <div className="text-gray-400 text-sm flex items-center gap-4 hidden md:flex">
            {modelInfo && (
              <span>
                {modelInfo.vertexCount.toLocaleString()} 顶点
                {modelInfo.hasFdcColor ? ' • f_dc 颜色通道' : ''}
                {' • '}
                {modelInfo.format}
              </span>
            )}
            <span className="hidden sm:inline">拖拽旋转 | 滚轮缩放</span>
          </div>
        </div>
      </div>

      {/* 3D 画布 */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={containerRef} className="absolute inset-0" />
        {isLoading && (
          <LoadingSpinner />
        )}
        {showTutorial && <TutorialOverlay onClose={() => setShowTutorial(false)} />}
      </div>
    </div>
  );
}
