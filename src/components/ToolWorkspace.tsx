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
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* 极简说明 */}
      <div className="mb-8 text-center space-y-2">
        <p className="text-gray-600 text-lg">
          Turn your 2D photos into 3D models instantly.
        </p>
        <div className="flex items-center justify-center gap-2 text-sm text-gray-400 bg-gray-50 inline-block px-4 py-1.5 rounded-full mx-auto border border-gray-100">
          <ImageIcon className="w-4 h-4" />
          <span>支持 JPG、PNG、BMP、TIFF 格式</span>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl p-8 border border-gray-100 ring-1 ring-gray-100/50">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">上传图片</h2>

        {/* 拖放上传区域 */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`
            border-3 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 relative overflow-hidden group
            ${selectedFile ? 'border-purple-300 bg-purple-50/50' : 'border-gray-200 hover:border-purple-400 hover:bg-gray-50'}
          `}
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? (
            <div className="space-y-4 relative z-10">
              <div className="relative inline-block group-hover:scale-[1.02] transition-transform duration-300">
                <img
                  src={previewUrl}
                  alt="预览"
                  className="max-h-64 mx-auto rounded-xl shadow-sm object-contain bg-white"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors rounded-xl" />
              </div>
              <div className="bg-white/80 backdrop-blur-sm inline-block px-4 py-2 rounded-lg shadow-sm border border-gray-100">
                <p className="text-sm font-medium text-gray-900">{selectedFile?.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedFile?.size ? formatFileSize(selectedFile.size) : '0'} MB
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 py-8">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300 text-purple-600">
                <Upload className="w-10 h-10" />
              </div>
              <div>
                <p className="text-gray-900 font-semibold text-lg">点击或拖放图片到此处</p>
                <p className="text-sm text-gray-400 mt-2">最大支持 1GB 文件</p>
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
        <div className="mt-8 space-y-6">
          {state === 'processing' && (
            <div className="space-y-3 bg-gray-50 p-6 rounded-2xl border border-gray-100">
              <div className="flex justify-between text-sm text-gray-900 font-bold">
                <span className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                  {statusMessage || '处理中...'}
                </span>
                <span className="text-purple-600">{Math.round(progress)}%</span>
              </div>
              <div className="h-3 w-full bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-600 rounded-full transition-all duration-300 ease-out shadow-[0_0_10px_rgba(147,51,234,0.3)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">预计需 40-50 秒，请保持页面开启</p>
            </div>
          )}

          {state === 'completed' ? (
            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
               {onPreview && (
                <button
                  onClick={handlePreview}
                  disabled={isLoadingPreview}
                  className="py-4 bg-purple-50 text-purple-700 rounded-xl hover:bg-purple-100 disabled:opacity-50 transition-all font-bold text-lg flex items-center justify-center gap-2 border-2 border-purple-100 hover:border-purple-200 hover:shadow-md active:scale-[0.98]"
                >
                  {isLoadingPreview ? <Loader2 className="w-6 h-6 animate-spin" /> : <Eye className="w-6 h-6" />}
                  预览模型
                </button>
              )}
              <button
                onClick={handleDownload}
                className={`${onPreview ? '' : 'col-span-2'} py-4 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all font-bold text-lg flex items-center justify-center gap-2 shadow-lg shadow-purple-200 hover:shadow-purple-300 active:scale-[0.98]`}
              >
                <Download className="w-6 h-6" />
                下载 .ply
              </button>
              <button
                onClick={handleReset}
                className="col-span-2 py-3 text-gray-400 hover:text-gray-600 text-sm flex items-center justify-center gap-1.5 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                开始新任务
              </button>
            </div>
          ) : (
            <div className="flex gap-4">
              <button
                onClick={handleGenerate}
                disabled={!selectedFile || state === 'uploading' || state === 'processing'}
                className={`
                  flex-1 py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg
                  ${!selectedFile || state === 'uploading' || state === 'processing' 
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed shadow-none' 
                    : 'bg-purple-600 text-white hover:bg-purple-700 hover:shadow-purple-300 active:scale-[0.98]'}
                `}
              >
                {state === 'uploading' || state === 'processing' ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    {state === 'uploading' ? '上传中...' : '生成中...'}
                  </>
                ) : (
                  <>
                    <Box className="w-6 h-6" />
                    开始生成 3D
                  </>
                )}
              </button>

              {(state === 'failed' || error) && (
                <button
                  onClick={handleReset}
                  className="px-6 py-4 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors font-bold border border-red-100"
                >
                  重试
                </button>
              )}
            </div>
          )}
          
          {error && (
             <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm text-center border border-red-100 animate-in fade-in slide-in-from-top-2">
               {error}
             </div>
          )}
        </div>
      </div>
    </div>
  );
}
