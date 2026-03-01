// SHARP API 客户端
// 图生3D API 调用封装

const DEFAULT_API_BASE_URL = 'https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1';
const envApiBaseUrl = import.meta.env.VITE_SHARP_API_BASE_URL;
const API_BASE_URL = envApiBaseUrl && !envApiBaseUrl.includes('workers.dev')
  ? envApiBaseUrl
  : DEFAULT_API_BASE_URL;

// API 响应类型
export interface UploadResponse {
  taskId: string;
  objectKey: string;
}

export interface TaskStatusResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  resultKey?: string;
  error?: string;
  raw?: any;
}

export interface ExecuteResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message?: string;
  startedAt?: string;
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

async function parseErrorMessage(response: Response): Promise<string> {
  const error = await response.json().catch(() => ({
    error: 'Unknown error',
    message: `HTTP ${response.status}: ${response.statusText}`,
  }));
  return error.message || error.error || 'Request failed';
}

// 上传图片
export async function uploadImage(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });

  const data = await handleResponse(response);
  return {
    taskId: data.task_id,
    objectKey: data.uploaded_file?.path || data.task_id,
  };
}

// 执行处理任务
export async function executeTask(taskId: string): Promise<ExecuteResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/execute`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      output_dir: '/root/autodl-tmp/ml-sharp/result/',
      model_path: '/root/autodl-tmp/ml-sharp/ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt',
    }),
  });

  const data = await handleResponse(response);
  return {
    taskId: data.task_id,
    status: data.status,
    message: data.message,
    startedAt: data.started_at,
  };
}

// 查询任务状态
export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
  const data = await handleResponse(response);
  return {
    taskId: data.task_id,
    status: data.status,
    message: data.message,
    resultKey: data.result?.output_file,
    error: data.error,
    raw: data,
  };
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
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/download`);
  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// 获取 PLY 文件数据（用于预览）
export async function fetchPlyData(taskId: string): Promise<ArrayBuffer> {
  const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/download`);
  if (!response.ok) {
    const message = await parseErrorMessage(response);
    throw new Error(message);
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
    await executeTask(uploadData.taskId);
    if (onExecuteProgress) onExecuteProgress('处理中...');

    const result = await pollTaskStatus(uploadData.taskId, {
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

