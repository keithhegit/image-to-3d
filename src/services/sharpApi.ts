// SHARP API 客户端
// 图生3D API 调用封装

const API_BASE_URL = import.meta.env.VITE_SHARP_API_BASE_URL || 'https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1';

// 固定配置
const FIXED_CONFIG = {
  output_dir: '/root/autodl-tmp/ml-sharp/result/',
  model_path: '/root/autodl-tmp/ml-sharp/ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt',
};

// API 响应类型
export interface UploadResponse {
  task_id: string;
  status: string;
  message: string;
  uploaded_file: {
    filename: string;
    size: number;
    path: string;
  };
}

export interface TaskStatusResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  started_at?: string;
  updated_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  result?: {
    output_file: string;
    file_size: number;
    file_size_mb: number;
  };
  error?: string;
}

export interface ExecuteResponse {
  task_id: string;
  status: string;
  message: string;
}

// 处理 API 响应
async function handleResponse(response: Response): Promise<any> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`,
    }));
    throw new Error(error.message || error.error || 'Request failed');
  }
  return response.json();
}

// 上传图片
export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  return handleResponse(response);
}

// 执行处理任务
export async function executeTask(taskId: string): Promise<ExecuteResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(FIXED_CONFIG),
  });

  return handleResponse(response);
}

// 查询任务状态
export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
  return handleResponse(response);
}

// 轮询任务状态
export interface PollOptions {
  interval?: number;
  onProgress?: (data: TaskStatusResponse) => void;
  onComplete?: (data: TaskStatusResponse) => void;
  onError?: (error: Error, data?: TaskStatusResponse) => void;
  maxAttempts?: number;
}

export async function pollTaskStatus(
  taskId: string,
  options: PollOptions = {}
): Promise<TaskStatusResponse> {
  const {
    interval = 2000,
    onProgress,
    onComplete,
    onError,
    maxAttempts = 300,
  } = options;

  let attempts = 0;

  return new Promise((resolve, reject) => {
    const poll = async () => {
      attempts++;

      if (attempts > maxAttempts) {
        const error = new Error('Polling timeout');
        if (onError) onError(error);
        reject(error);
        return;
      }

      try {
        const data = await getTaskStatus(taskId);

        if (onProgress) {
          onProgress(data);
        }

        if (data.status === 'completed') {
          if (onComplete) onComplete(data);
          resolve(data);
        } else if (data.status === 'failed') {
          const error = new Error(data.error || 'Task failed');
          if (onError) onError(error, data);
          reject(error);
        } else {
          setTimeout(poll, interval);
        }
      } catch (error) {
        if (onError) onError(error as Error);
        reject(error);
      }
    };

    poll();
  });
}

// 下载结果文件
export async function downloadTaskResult(taskId: string, filename = 'result.ply'): Promise<void> {
  const url = `${API_BASE_URL}/tasks/${taskId}/download`;
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// 获取 PLY 文件数据（用于预览）
export async function fetchPlyData(taskId: string): Promise<ArrayBuffer> {
  const url = `${API_BASE_URL}/tasks/${taskId}/download`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`获取 PLY 文件失败: ${response.statusText}`);
  }
  return response.arrayBuffer();
}

// 完整的处理流程
export interface ProcessOptions {
  onUploadProgress?: (message: string) => void;
  onExecuteProgress?: (message: string) => void;
  onStatusUpdate?: (status: TaskStatusResponse) => void;
  onComplete?: (result: TaskStatusResponse) => void;
  onError?: (error: Error) => void;
}

export async function processImage(
  file: File,
  options: ProcessOptions = {}
): Promise<TaskStatusResponse> {
  const {
    onUploadProgress,
    onExecuteProgress,
    onStatusUpdate,
    onComplete,
    onError,
  } = options;

  try {
    if (onUploadProgress) onUploadProgress('上传中...');
    const uploadData = await uploadImage(file);
    if (onUploadProgress) onUploadProgress('上传完成');

    if (onExecuteProgress) onExecuteProgress('开始处理...');
    await executeTask(uploadData.task_id);
    if (onExecuteProgress) onExecuteProgress('处理中...');

    const result = await pollTaskStatus(uploadData.task_id, {
      onProgress: onStatusUpdate,
      onComplete,
      onError,
    });

    return result;
  } catch (error) {
    if (onError) onError(error as Error);
    throw error;
  }
}


