import { useRef, useState, useEffect } from 'react';
import { Upload, Box, Download, Loader2, CheckCircle, XCircle, Image as ImageIcon, Eye } from 'lucide-react';
import {
  processImage,
  downloadTaskResult,
  fetchPlyData,
} from '../services/sharpApi';
import { WorkspaceState } from '../App';

// 图生3D工具常量
const TOOL_CONFIG = {
  name: '图生3D',
  description: '将 2D 图片转换为 3D 模型（.ply 格式），支持 JPG、PNG、BMP、TIFF 格式',
  emoji: '📦',
} as const;

// 文件验证配置
const FILE_VALIDATION = {
  validTypes: ['image/jpeg', 'image/png', 'image/bmp', 'image/tiff'],
  maxSizeBytes: 1024 * 1024 * 1024, // 1GB
  maxSizeMB: 1024,
} as const;

// 文件大小格式化
const formatFileSize = (bytes: number): string => {
  return (bytes / 1024 / 1024).toFixed(2);
};

interface ToolWorkspaceProps {
  onPreview?: (plyData: ArrayBuffer, fileName: string) => void;
  workspaceState: WorkspaceState;
  setWorkspaceState: React.Dispatch<React.SetStateAction<WorkspaceState>>;
}

export function ToolWorkspace({ onPreview, workspaceState, setWorkspaceState }: ToolWorkspaceProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { selectedFile, previewUrl, state, statusMessage, taskId, result, error } = workspaceState;
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [progress, setProgress] = useState(0);

  // 伪进度条逻辑
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'processing') {
      setProgress(0);
      interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return prev; // 卡在 90%
          // 前 40秒 (40000ms) 走到 90% -> 每 100ms 走 90/400 = 0.225
          return prev + 0.2; 
        });
      }, 100);
    } else if (state === 'completed') {
      setProgress(100);
    } else {
      setProgress(0);
    }
    return () => clearInterval(interval);
  }, [state]);

  // 统一更新状态
  const updateState = (updates: Partial<WorkspaceState>) => {
    setWorkspaceState(prev => ({ ...prev, ...updates }));
  };

  // 验证文件
  const validateFile = (file: File): string | null => {
    if (!FILE_VALIDATION.validTypes.includes(file.type)) {
      return '请选择支持的图片格式（JPG、PNG、BMP、TIFF）';
    }
    if (file.size > FILE_VALIDATION.maxSizeBytes) {
      return `文件大小不能超过 ${FILE_VALIDATION.maxSizeMB}MB`;
    }
    return null;
  };

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const err = validateFile(file);
    if (err) {
      alert(err);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      updateState({
        selectedFile: file,
        previewUrl: event.target?.result as string,
        state: 'idle',
        statusMessage: '',
        taskId: null,
        result: null,
        error: null
      });
    };
    reader.readAsDataURL(file);
  };

  // 处理拖放上传
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      const fakeEvent = { target: { files: [file] } } as unknown as React.ChangeEvent<HTMLInputElement>;
      handleFileChange(fakeEvent);
    }
  };

  // 开始生成
  const handleGenerate = async () => {
    if (!selectedFile) {
      alert('请先上传图片');
      return;
    }

    updateState({ state: 'uploading', statusMessage: '上传中...', error: null, result: null });

    try {
      const resultData = await processImage(selectedFile, {
        onUploadProgress: (msg) => {
          updateState({ statusMessage: msg });
        },
        onExecuteProgress: (msg) => {
          updateState({ state: 'processing', statusMessage: msg });
        },
        onStatusUpdate: (status) => {
          updateState({ taskId: status.taskId, state: 'processing' });
          if (status.status === 'processing') {
            updateState({ statusMessage: '正在生成 3D 模型...' });
          }
        },
        onComplete: async (data) => {
          updateState({ result: data, state: 'completed', statusMessage: '处理完成！' });
        },
        onError: (err) => {
          updateState({ error: err.message, state: 'failed', statusMessage: '处理失败' });
        },
      });

      updateState({ result: resultData, state: 'completed', statusMessage: '处理完成！' });
    } catch (err) {
      updateState({ error: (err as Error).message, state: 'failed', statusMessage: '处理失败' });
    }
  };

  // 下载结果
  const handleDownload = async () => {
    if (!taskId) return;

    try {
      updateState({ statusMessage: '下载中...' });
      await downloadTaskResult(taskId, `${selectedFile?.name.split('.')[0] || 'result'}.ply`);
      updateState({ statusMessage: '下载完成' });
    } catch (err) {
      alert('下载失败：' + (err as Error).message);
      updateState({ statusMessage: '下载失败' });
    }
  };

  // 预览 3D 模型
  const handlePreview = async () => {
    if (!taskId || !onPreview) return;

    try {
      setIsLoadingPreview(true);
      updateState({ statusMessage: '加载预览...' });
      const plyData = await fetchPlyData(taskId);
      const fileName = `${selectedFile?.name.split('.')[0] || 'result'}.ply`;
      onPreview(plyData, fileName);
      updateState({ statusMessage: '处理完成！' });
    } catch (err) {
      alert('加载预览失败：' + (err as Error).message);
      updateState({ statusMessage: '加载预览失败' });
    } finally {
      setIsLoadingPreview(false);
    }
  };

  // 重置
  const handleReset = () => {
    updateState({
      selectedFile: null,
      previewUrl: null,
      state: 'idle',
      statusMessage: '',
      taskId: null,
      result: null,
      error: null
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* 标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <Box className="w-8 h-8 text-purple-600" />
          {TOOL_CONFIG.name}
        </h1>
        <p className="text-gray-600">
          {TOOL_CONFIG.description}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：上传区域 */}
        <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">上传图片</h2>

          {/* 拖放上传区域 */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
              ${selectedFile ? 'border-purple-300 bg-purple-50' : 'border-gray-200 hover:border-purple-400 hover:bg-purple-50/50'}
            `}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <div className="space-y-4">
                <img
                  src={previewUrl}
                  alt="预览"
                  className="max-h-64 mx-auto rounded-lg object-contain"
                />
                <p className="text-sm text-gray-600">{selectedFile?.name}</p>
                <p className="text-xs text-gray-500">
                  {selectedFile?.size ? formatFileSize(selectedFile.size) : '0'} MB
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <Upload className="w-16 h-16 mx-auto text-gray-400" />
                <div>
                  <p className="text-gray-700 font-medium">点击或拖放图片到此处</p>
                  <p className="text-sm text-gray-500 mt-1">支持 JPG、PNG、BMP、TIFF（最大 1GB）</p>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/bmp,image/tiff"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* 操作区域：进度条与按钮 */}
          <div className="mt-6 space-y-4">
            {state === 'processing' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600 font-medium">
                  <span>{statusMessage || '处理中...'}</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-purple-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 text-center">预计需 40-50 秒，请耐心等待</p>
              </div>
            )}

            {state === 'completed' ? (
              <div className="grid grid-cols-2 gap-3">
                 {onPreview && (
                  <button
                    onClick={handlePreview}
                    disabled={isLoadingPreview}
                    className="py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2 border border-purple-200"
                  >
                    {isLoadingPreview ? <Loader2 className="w-5 h-5 animate-spin" /> : <Eye className="w-5 h-5" />}
                    预览模型
                  </button>
                )}
                <button
                  onClick={handleDownload}
                  className={`${onPreview ? '' : 'col-span-2'} py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium flex items-center justify-center gap-2 shadow-sm`}
                >
                  <Download className="w-5 h-5" />
                  下载 .ply
                </button>
                <button
                  onClick={handleReset}
                  className="col-span-2 py-2 text-gray-500 hover:text-gray-700 text-sm flex items-center justify-center gap-1"
                >
                  <XCircle className="w-4 h-4" />
                  重新开始
                </button>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handleGenerate}
                  disabled={!selectedFile || state === 'uploading' || state === 'processing'}
                  className="flex-1 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors font-medium flex items-center justify-center gap-2 shadow-sm"
                >
                  {state === 'uploading' || state === 'processing' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      {state === 'uploading' ? '上传中...' : '生成中...'}
                    </>
                  ) : (
                    <>
                      <Box className="w-5 h-5" />
                      开始生成 3D
                    </>
                  )}
                </button>

                {(state === 'failed' || error) && (
                  <button
                    onClick={handleReset}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium border border-gray-200"
                  >
                    重置
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 右侧：状态和结果 */}
        <div className="space-y-6">
          {/* 处理状态 */}
          <div className="bg-white rounded-2xl shadow-md p-8 border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">处理状态</h2>

            {state === 'idle' && (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
                <p>上传图片并点击生成开始处理</p>
              </div>
            )}

            {(state === 'uploading' || state === 'processing') && (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-16 h-16 text-purple-600 animate-spin mb-4" />
                <p className="text-gray-700 font-medium">{statusMessage}</p>
                <p className="text-sm text-gray-500 mt-2">这可能需要几分钟时间</p>
              </div>
            )}

            {state === 'completed' && result && (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8 text-green-600">
                  <CheckCircle className="w-16 h-16" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 mb-2">处理完成！</p>
                  {result.resultKey && (
                    <p className="text-gray-600">
                      结果文件：{result.resultKey}
                    </p>
                  )}
                </div>

                {/* 按钮组已移动到左侧 */}
                <div className="text-center text-sm text-gray-500">
                  <p>请在左侧预览或下载结果</p>
                </div>
              </div>
            )}

            {state === 'failed' && (
              <div className="space-y-4">
                <div className="flex items-center justify-center py-8 text-red-600">
                  <XCircle className="w-16 h-16" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-gray-900 mb-2">处理失败</p>
                  <p className="text-gray-600 bg-red-50 p-3 rounded-lg text-sm border border-red-100">{error || '未知错误'}</p>
                </div>
              </div>
            )}
          </div>

          {/* 使用说明 */}
          <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
            <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
              <span className="text-lg">💡</span> 使用说明
            </h3>
            <ul className="text-sm text-purple-700 space-y-2">
              <li>• 支持的图片格式：JPG、PNG、BMP、TIFF</li>
              <li>• 建议上传清晰的正面图片以获得最佳效果</li>
              <li>• 处理时间取决于图片大小，通常需要 1-3 分钟</li>
              <li>• 输出格式为 .ply，可用 3D 编辑软件或在线预览器打开</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
