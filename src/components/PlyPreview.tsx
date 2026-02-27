// PLY 3D模型预览组件（Gaussian Splat 渲染）
import { useEffect, useMemo, useRef, useState } from 'react';
import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import { ArrowLeft, Loader2 } from 'lucide-react';

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
      cameraUp: [0, -1, -0.6],
      initialCameraPosition: [-1, -4, 6],
      initialCameraLookAt: [0, 4, 0],
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
          <div className="text-white font-medium truncate max-w-md">
            {fileName}
          </div>
          <div className="text-gray-400 text-sm flex items-center gap-4">
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
      <div className="flex-1 relative">
        <div ref={containerRef} className="absolute inset-0" />
        {isLoading && (
          <LoadingSpinner />
        )}
      </div>
    </div>
  );
}
