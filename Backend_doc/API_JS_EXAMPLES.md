# SHARP API JavaScript 调用示例

本文档提供使用 JavaScript/TypeScript 调用 SHARP API 的完整示例。

## 目录

- [基础设置](#基础设置)
- [使用 Fetch API](#使用-fetch-api)
- [使用 Axios](#使用-axios)
- [完整示例](#完整示例)
- [错误处理](#错误处理)
- [React 示例](#react-示例)
- [Vue 示例](#vue-示例)

## 基础设置

### API 基础 URL

```javascript
const API_BASE_URL = 'https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1';
```

### 辅助函数：处理响应

```javascript
async function handleResponse(response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ 
      error: 'Unknown error',
      message: `HTTP ${response.status}: ${response.statusText}`
    }));
    throw new Error(error.message || error.error || 'Request failed');
  }
  return response.json();
}
```

## 使用 Fetch API

### 1. 上传图片

```javascript
async function uploadImage(file, outputDir = null) {
  const formData = new FormData();
  formData.append('file', file);
  
  if (outputDir) {
    formData.append('output_dir', outputDir);
  }
  
  try {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    const data = await handleResponse(response);
    return data;
  } catch (error) {
    console.error('Upload failed:', error);
    throw error;
  }
}

// 使用示例
const fileInput = document.querySelector('#file-input');
const file = fileInput.files[0];

uploadImage(file)
  .then(data => {
    console.log('Upload successful:', data);
    console.log('Task ID:', data.task_id);
  })
  .catch(error => {
    console.error('Upload error:', error);
  });
```

### 2. 执行处理任务
##### output_dir固定为“/root/autodl-tmp/ml-sharp/result/”，
##### model_path固定为“/root/autodl-tmp/ml-sharp/ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt”
##### 不然会报错

```javascript
async function executeTask(taskId, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        output_dir: options.outputDir,
        model_path: options.modelPath,
      }),
    });
    
    const data = await handleResponse(response);
    return data;
  } catch (error) {
    console.error('Execute failed:', error);
    throw error;
  }
}

// 使用示例
executeTask('550e8400-e29b-41d4-a716-446655440000')
  .then(data => {
    console.log('Task started:', data);
  })
  .catch(error => {
    console.error('Execute error:', error);
  });
```

### 3. 查询任务状态

```javascript
async function getTaskStatus(taskId) {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
    const data = await handleResponse(response);
    return data;
  } catch (error) {
    console.error('Get status failed:', error);
    throw error;
  }
}

// 使用示例
getTaskStatus('550e8400-e29b-41d4-a716-446655440000')
  .then(data => {
    console.log('Task status:', data.status);
    console.log('Message:', data.message);
    
    if (data.status === 'completed') {
      console.log('Result file:', data.result.output_file);
      console.log('File size:', data.result.file_size_mb, 'MB');
    } else if (data.status === 'failed') {
      console.error('Error:', data.error);
    }
  });
```

### 4. 轮询任务状态（带进度显示）

```javascript
async function pollTaskStatus(taskId, options = {}) {
  const {
    interval = 2000,        // 轮询间隔（毫秒）
    onProgress = null,      // 进度回调
    maxAttempts = 300,      // 最大尝试次数（默认10分钟）
    onComplete = null,      // 完成回调
    onError = null,         // 错误回调
  } = options;
  
  let attempts = 0;
  
  const poll = async () => {
    attempts++;
    
    if (attempts > maxAttempts) {
      const error = new Error('Polling timeout');
      if (onError) onError(error);
      throw error;
    }
    
    try {
      const data = await getTaskStatus(taskId);
      
      // 调用进度回调
      if (onProgress) {
        onProgress(data);
      }
      
      // 检查状态
      if (data.status === 'completed') {
        if (onComplete) {
          onComplete(data);
        }
        return data;
      } else if (data.status === 'failed') {
        const error = new Error(data.error || 'Task failed');
        if (onError) {
          onError(error, data);
        }
        throw error;
      } else {
        // 继续轮询
        setTimeout(poll, interval);
      }
    } catch (error) {
      if (onError) {
        onError(error);
      }
      throw error;
    }
  };
  
  // 开始轮询
  poll();
}

// 使用示例
pollTaskStatus('550e8400-e29b-41d4-a716-446655440000', {
  interval: 2000,
  onProgress: (data) => {
    console.log(`Status: ${data.status} (attempt ${attempts})`);
    // 更新 UI 进度
    updateProgressBar(data.status);
  },
  onComplete: (data) => {
    console.log('Task completed!', data);
    showSuccessMessage('处理完成！');
  },
  onError: (error, data) => {
    console.error('Task failed:', error);
    showErrorMessage(data?.error || error.message);
  },
});
```

### 5. 下载结果文件

```javascript
async function downloadTaskResult(taskId, filename = 'result.ply') {
  try {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/download`);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return blob;
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

// 使用示例
downloadTaskResult('550e8400-e29b-41d4-a716-446655440000', 'my-result.ply')
  .then(() => {
    console.log('Download completed');
  })
  .catch(error => {
    console.error('Download error:', error);
  });
```

### 6. 查询历史记录

```javascript
async function getHistory(options = {}) {
  const {
    limit = 50,
    offset = 0,
    sort = 'latest',  // 'latest' or 'oldest'
  } = options;
  
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
    sort: sort,
  });
  
  try {
    const response = await fetch(`${API_BASE_URL}/history?${params}`);
    const data = await handleResponse(response);
    return data;
  } catch (error) {
    console.error('Get history failed:', error);
    throw error;
  }
}

// 使用示例
getHistory({ limit: 20, offset: 0, sort: 'latest' })
  .then(data => {
    console.log(`Total files: ${data.total}`);
    console.log('Files:', data.files);
    
    data.files.forEach(file => {
      console.log(`${file.filename}: ${file.size_mb} MB`);
    });
  });
```

### 7. 下载历史文件

```javascript
async function downloadHistoryFile(filename) {
  try {
    const response = await fetch(
      `${API_BASE_URL}/history/${encodeURIComponent(filename)}/download`
    );
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    
    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    // 清理
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    return blob;
  } catch (error) {
    console.error('Download failed:', error);
    throw error;
  }
}

// 使用示例
downloadHistoryFile('image.ply')
  .then(() => {
    console.log('File downloaded');
  });
```

## 使用 Axios

如果你更喜欢使用 Axios，可以这样实现：

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:8000/api/v1';

// 创建 axios 实例
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000, // 5分钟超时
});

// 上传图片
async function uploadImage(file, outputDir = null) {
  const formData = new FormData();
  formData.append('file', file);
  if (outputDir) {
    formData.append('output_dir', outputDir);
  }
  
  const response = await apiClient.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return response.data;
}

// 执行任务
async function executeTask(taskId, options = {}) {
  const response = await apiClient.post(
    `/tasks/${taskId}/execute`,
    {
      output_dir: options.outputDir,
      model_path: options.modelPath,
    }
  );
  
  return response.data;
}

// 查询状态
async function getTaskStatus(taskId) {
  const response = await apiClient.get(`/tasks/${taskId}`);
  return response.data;
}

// 下载文件（使用 blob 响应）
async function downloadTaskResult(taskId, filename = 'result.ply') {
  const response = await apiClient.get(
    `/tasks/${taskId}/download`,
    {
      responseType: 'blob',
    }
  );
  
  // 创建下载链接
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}
```

## 完整示例

### 完整的处理流程

```javascript
class SharpAPIClient {
  constructor(baseURL = 'http://localhost:8000/api/v1') {
    this.baseURL = baseURL;
  }
  
  async uploadImage(file, outputDir = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (outputDir) formData.append('output_dir', outputDir);
    
    const response = await fetch(`${this.baseURL}/upload`, {
      method: 'POST',
      body: formData,
    });
    
    return this.handleResponse(response);
  }
  
  async executeTask(taskId, options = {}) {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
    
    return this.handleResponse(response);
  }
  
  async getTaskStatus(taskId) {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}`);
    return this.handleResponse(response);
  }
  
  async downloadResult(taskId, filename = 'result.ply') {
    const response = await fetch(`${this.baseURL}/tasks/${taskId}/download`);
    
    if (!response.ok) {
      throw new Error(`Download failed: ${response.statusText}`);
    }
    
    const blob = await response.blob();
    this.downloadBlob(blob, filename);
    return blob;
  }
  
  async processImage(file, callbacks = {}) {
    const {
      onUploadProgress,
      onExecuteProgress,
      onStatusUpdate,
      onComplete,
      onError,
    } = callbacks;
    
    try {
      // 1. 上传图片
      if (onUploadProgress) onUploadProgress('Uploading...');
      const uploadData = await this.uploadImage(file);
      const taskId = uploadData.task_id;
      
      if (onUploadProgress) onUploadProgress('Uploaded');
      
      // 2. 执行处理
      if (onExecuteProgress) onExecuteProgress('Starting...');
      await this.executeTask(taskId);
      
      // 3. 轮询状态
      return new Promise((resolve, reject) => {
        const poll = async () => {
          try {
            const status = await this.getTaskStatus(taskId);
            
            if (onStatusUpdate) {
              onStatusUpdate(status);
            }
            
            if (status.status === 'completed') {
              if (onComplete) {
                onComplete(status);
              }
              resolve(status);
            } else if (status.status === 'failed') {
              const error = new Error(status.error || 'Task failed');
              if (onError) {
                onError(error, status);
              }
              reject(error);
            } else {
              // 继续轮询
              setTimeout(poll, 2000);
            }
          } catch (error) {
            if (onError) {
              onError(error);
            }
            reject(error);
          }
        };
        
        poll();
      });
    } catch (error) {
      if (onError) {
        onError(error);
      }
      throw error;
    }
  }
  
  async handleResponse(response) {
    if (!response.ok) {
      const error = await response.json().catch(() => ({
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      }));
      throw new Error(error.message || error.error || 'Request failed');
    }
    return response.json();
  }
  
  downloadBlob(blob, filename) {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}

// 使用示例
const client = new SharpAPIClient();

const fileInput = document.querySelector('#file-input');
const file = fileInput.files[0];

client.processImage(file, {
  onUploadProgress: (message) => {
    console.log('Upload:', message);
    updateUI('upload', message);
  },
  onExecuteProgress: (message) => {
    console.log('Execute:', message);
    updateUI('execute', message);
  },
  onStatusUpdate: (status) => {
    console.log('Status:', status.status);
    updateUI('status', status.status);
  },
  onComplete: (result) => {
    console.log('Completed!', result);
    showSuccess('处理完成！');
    
    // 自动下载结果
    client.downloadResult(result.task_id, 'result.ply');
  },
  onError: (error) => {
    console.error('Error:', error);
    showError(error.message);
  },
});
```

## 错误处理

### 统一错误处理

```javascript
class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'APIError';
    this.status = status;
    this.data = data;
  }
}

async function handleAPIError(response) {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = {
        error: 'Unknown error',
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }
    
    throw new APIError(
      errorData.message || errorData.error || 'Request failed',
      response.status,
      errorData
    );
  }
  
  return response.json();
}

// 使用示例
try {
  const data = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  }).then(handleAPIError);
  
  console.log('Success:', data);
} catch (error) {
  if (error instanceof APIError) {
    console.error(`API Error (${error.status}):`, error.message);
    console.error('Error data:', error.data);
  } else {
    console.error('Network error:', error);
  }
}
```

## React 示例

### React Hook 示例

```jsx
import { useState, useCallback } from 'react';

function useSharpAPI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [taskId, setTaskId] = useState(null);
  const [status, setStatus] = useState(null);
  
  const uploadImage = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('http://localhost:8000/api/v1/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const data = await response.json();
      setTaskId(data.task_id);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const executeTask = useCallback(async (taskId) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `http://localhost:8000/api/v1/tasks/${taskId}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }
      );
      
      if (!response.ok) {
        throw new Error('Execute failed');
      }
      
      const data = await response.json();
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const pollStatus = useCallback(async (taskId) => {
    const poll = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/api/v1/tasks/${taskId}`
        );
        
        if (!response.ok) {
          throw new Error('Get status failed');
        }
        
        const data = await response.json();
        setStatus(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          return data;
        }
        
        // 继续轮询
        setTimeout(poll, 2000);
      } catch (err) {
        setError(err.message);
        throw err;
      }
    };
    
    poll();
  }, []);
  
  return {
    loading,
    error,
    taskId,
    status,
    uploadImage,
    executeTask,
    pollStatus,
  };
}

// 使用示例
function ImageProcessor() {
  const { uploadImage, executeTask, pollStatus, loading, status } = useSharpAPI();
  
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      // 上传
      const uploadData = await uploadImage(file);
      
      // 执行
      await executeTask(uploadData.task_id);
      
      // 轮询状态
      await pollStatus(uploadData.task_id);
    } catch (error) {
      console.error('Error:', error);
    }
  };
  
  return (
    <div>
      <input type="file" onChange={handleFileUpload} disabled={loading} />
      {loading && <p>Processing...</p>}
      {status && (
        <div>
          <p>Status: {status.status}</p>
          {status.status === 'completed' && (
            <p>File size: {status.result.file_size_mb} MB</p>
          )}
        </div>
      )}
    </div>
  );
}
```

## Vue 示例

### Vue 3 Composition API 示例

```vue
<template>
  <div>
    <input 
      type="file" 
      @change="handleFileUpload" 
      :disabled="loading"
    />
    <div v-if="loading">Processing...</div>
    <div v-if="status">
      <p>Status: {{ status.status }}</p>
      <p v-if="status.status === 'completed'">
        File size: {{ status.result.file_size_mb }} MB
      </p>
    </div>
    <div v-if="error" class="error">{{ error }}</div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const API_BASE_URL = 'http://localhost:8000/api/v1';

const loading = ref(false);
const error = ref(null);
const status = ref(null);
const taskId = ref(null);

async function uploadImage(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
  
  return response.json();
}

async function executeTask(taskId) {
  const response = await fetch(
    `${API_BASE_URL}/tasks/${taskId}/execute`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );
  
  if (!response.ok) {
    throw new Error('Execute failed');
  }
  
  return response.json();
}

async function pollStatus(taskId) {
  const poll = async () => {
    const response = await fetch(`${API_BASE_URL}/tasks/${taskId}`);
    
    if (!response.ok) {
      throw new Error('Get status failed');
    }
    
    const data = await response.json();
    status.value = data;
    
    if (data.status === 'completed' || data.status === 'failed') {
      loading.value = false;
      return data;
    }
    
    setTimeout(poll, 2000);
  };
  
  poll();
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  loading.value = true;
  error.value = null;
  
  try {
    // 上传
    const uploadData = await uploadImage(file);
    taskId.value = uploadData.task_id;
    
    // 执行
    await executeTask(uploadData.task_id);
    
    // 轮询状态
    await pollStatus(uploadData.task_id);
  } catch (err) {
    error.value = err.message;
    loading.value = false;
  }
}
</script>
```

## 注意事项

1. **CORS 配置**：确保 API 服务器配置了正确的 CORS 设置
2. **文件大小**：大文件上传时考虑显示上传进度
3. **超时处理**：长时间运行的任务需要设置合适的超时时间
4. **错误处理**：始终处理可能的网络错误和 API 错误
5. **轮询优化**：根据任务类型调整轮询间隔，避免过于频繁的请求

## 更多资源

- [Fetch API 文档](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [Axios 文档](https://axios-http.com/)
- [FormData API](https://developer.mozilla.org/en-US/docs/Web/API/FormData)
