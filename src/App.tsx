import { useState, useEffect } from 'react';
import { ToolWorkspace } from './components/ToolWorkspace';
import { PlyPreview } from './components/PlyPreview';

interface PreviewData {
  plyData: ArrayBuffer;
  fileName: string;
}

// 定义工作区状态接口
export interface WorkspaceState {
  selectedFile: File | null;
  previewUrl: string | null;
  state: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  statusMessage: string;
  taskId: string | null;
  result: any | null;
  error: string | null;
}

function App() {
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);

  // 初始化工作区状态
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>(() => {
    const savedTaskId = sessionStorage.getItem('last_task_id');
    return {
      selectedFile: null,
      previewUrl: null,
      state: savedTaskId ? 'completed' : 'idle',
      statusMessage: savedTaskId ? '找到之前的任务' : '',
      taskId: savedTaskId,
      result: null,
      error: null,
    };
  });

  // 持久化 taskId
  useEffect(() => {
    if (workspaceState.taskId) {
      sessionStorage.setItem('last_task_id', workspaceState.taskId);
    }
  }, [workspaceState.taskId]);

  // 进入预览模式
  const handlePreview = (plyData: ArrayBuffer, fileName: string) => {
    setPreviewData({ plyData, fileName });
  };

  // 退出预览模式
  const handleBackFromPreview = () => {
    setPreviewData(null);
  };

  // 渲染主页面
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
              3D
            </div>
            <span className="text-xl font-bold text-gray-900 tracking-tight">Sharp Image to 3D</span>
          </div>
          <div className="text-sm text-gray-500">Standalone Version</div>
        </div>
      </nav>

      <main className="flex-1 relative overflow-hidden">
        {/* 使用 hidden 类控制显示，防止组件卸载导致状态丢失 */}
        <div className={`h-full overflow-y-auto ${previewData ? 'hidden' : 'block'}`}>
          <ToolWorkspace 
            onPreview={handlePreview} 
            workspaceState={workspaceState}
            setWorkspaceState={setWorkspaceState}
          />
        </div>

        {/* 预览页面 */}
        {previewData && (
          <div className="absolute inset-0 z-50">
            <PlyPreview
              plyData={previewData.plyData}
              fileName={previewData.fileName}
              onBack={handleBackFromPreview}
            />
          </div>
        )}
      </main>

      {!previewData && (
        <footer className="max-w-6xl mx-auto px-6 py-12 text-center text-gray-400 text-sm shrink-0">
          &copy; {new Date().getFullYear()} Sharp Image to 3D Standalone. 部署在 Cloudflare.
        </footer>
      )}
    </div>
  );
}

export default App;


