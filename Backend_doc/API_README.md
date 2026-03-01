# SHARP API 使用说明

## API 端点

### 1. 上传图片
```bash
POST /api/v1/upload
Content-Type: multipart/form-data

curl -X POST "https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/upload" \
  -F "file=@image.png" \
  -F "output_dir=/path/to/output"  # 可选
```

**响应示例：**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Image uploaded successfully",
  "uploaded_file": {
    "filename": "image.png",
    "size": 1024000,
    "path": "/tmp/sharp_uploads/uuid-image.png"
  }
}
```

### 2. 执行处理任务
```bash
POST /api/v1/tasks/{task_id}/execute
Content-Type: application/json

curl -X POST "https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/{task_id}/execute" \
  -H "Content-Type: application/json" \
  -d '{
    "output_dir": "/root/autodl-tmp/ml-sharp/result/",  # 固定
    "model_path": "/root/autodl-tmp/ml-sharp/ml-site.cdn-apple.com/models/sharp/sharp_2572gikvuh.pt"  # 固定
  }'
```

### 3. 查询任务状态
```bash
GET /api/v1/tasks/{task_id}

curl "https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/{task_id}"
```

**响应示例（处理中）：**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": "Task is processing",
  "started_at": "2025-01-20T10:00:00Z",
  "updated_at": "2025-01-20T10:00:30Z"
}
```

**响应示例（完成）：**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "message": "Processing completed successfully",
  "result": {
    "output_file": "/root/autodl-tmp/ml-sharp/result/image.ply",
    "file_size": 52428800,
    "file_size_mb": 50.0
  },
  "started_at": "2025-01-20T10:00:00Z",
  "completed_at": "2025-01-20T10:01:00Z",
  "duration_seconds": 60
}
```

### 4. 下载结果文件
```bash
GET /api/v1/tasks/{task_id}/download

curl -O "https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/{task_id}/download"
```

### 5. 查询历史记录
```bash
GET /api/v1/history?limit=50&offset=0&sort=latest

curl "https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/history?limit=50&offset=0&sort=latest"
```

### 6. 下载历史文件
```bash
GET /api/v1/history/{filename}/download

curl -O "https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/history/image.ply/download"
```

## 完整使用流程示例

### Python 示例

```python
import requests
import time

# 1. 上传图片
with open("image.png", "rb") as f:
    response = requests.post(
        "https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/upload",
        files={"file": f}
    )
    data = response.json()
    task_id = data["task_id"]
    print(f"Uploaded, task_id: {task_id}")

# 2. 执行处理
response = requests.post(
    f"https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/{task_id}/execute"
)
print("Task started")

# 3. 轮询任务状态
while True:
    response = requests.get(
        f"https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/{task_id}"
    )
    data = response.json()
    
    if data["status"] == "completed":
        print("Task completed!")
        break
    elif data["status"] == "failed":
        print(f"Task failed: {data.get('error')}")
        break
    else:
        print(f"Status: {data['status']}, waiting...")
        time.sleep(2)

# 4. 下载结果
if data["status"] == "completed":
    response = requests.get(
        f"https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/{task_id}/download"
    )
    with open("result.ply", "wb") as f:
        f.write(response.content)
    print("File downloaded: result.ply")
```

### JavaScript 示例

```javascript
// 1. 上传图片
const formData = new FormData();
formData.append('file', fileInput.files[0]);

const uploadResponse = await fetch('https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/upload', {
  method: 'POST',
  body: formData
});

const uploadData = await uploadResponse.json();
const taskId = uploadData.task_id;

// 2. 执行处理
await fetch(`https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/${taskId}/execute`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
});

// 3. 轮询任务状态
const checkStatus = async () => {
  const response = await fetch(`https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/${taskId}`);
  const data = await response.json();
  
  if (data.status === 'completed') {
    // 4. 下载结果
    const downloadResponse = await fetch(
      `https://u184490-b122-43342448.westb.seetacloud.com:8443/sharp/api/v1/tasks/${taskId}/download`
    );
    const blob = await downloadResponse.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result.ply';
    a.click();
  } else if (data.status === 'failed') {
    console.error('Task failed:', data.error);
  } else {
    setTimeout(checkStatus, 2000);
  }
};

checkStatus();
```

## 配置

可以通过环境变量或 `.env` 文件配置 API：

```bash
MODEL_PATH=/path/to/model.pt
DEFAULT_OUTPUT_DIR=/path/to/output
UPLOAD_DIR=/tmp/sharp_uploads
MAX_UPLOAD_SIZE=1073741824  # 1GB in bytes
API_PORT=8000
API_HOST=0.0.0.0
```

## 注意事项

1. **文件大小限制**：默认最大上传文件大小为 1GB，可在配置中修改
2. **支持的文件格式**：jpg, jpeg, png, bmp, tiff, tif
3. **任务状态**：任务状态存储在内存中，服务器重启后会丢失（生产环境建议使用 Redis）
4. **CORS**：默认允许所有来源，生产环境应配置具体的允许来源

## 故障排除

### 端口被占用
```bash
# 修改端口
uvicorn api.main:app --host 0.0.0.0 --port 8001
```

### 文件上传失败
- 检查文件大小是否超过限制
- 检查文件格式是否支持
- 检查上传目录权限

### 任务执行失败
- 检查 sharp CLI 是否已安装
- 检查模型文件路径是否正确
- 查看服务器日志获取详细错误信息

