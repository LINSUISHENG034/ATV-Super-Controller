# Docker 部署验证指南

## 前置条件

### 1. Android TV 设备准备

在开始 Docker 部署验证前，必须先在 Android TV 上启用网络调试：

1. **启用开发者选项**
   - 设置 > 设备偏好设置 > 关于
   - 找到 **版本号** 或 **版本**，连续点击 7 次
   - 看到"您已成为开发者"提示

2. **启用网络调试**
   - 设置 > 设备偏好设置 > 开发者选项
   - 开启 **USB 调试**
   - 开启 **网络调试** (或 "ADB 网络调试")
   - 记录 TV 显示的 IP 地址

3. **验证 ADB 端口开放**
   ```bash
   # 从宿主机测试端口
   nc -zv <TV_IP> 5555
   # 或
   telnet <TV_IP> 5555
   ```

### 2. 本地验证（非 Docker）

```bash
cd E:\Projects\ATV-Super-Controller
node src/index.js status
```

应该显示设备已连接。本地验证通过后再进行 Docker 部署。

---

## Docker 部署验证步骤

### Step 1: 创建必要目录

```bash
cd E:\Projects\ATV-Super-Controller
mkdir -p adb-keys
mkdir -p config
```

### Step 2: 准备配置文件

确保 `config/config.json` 存在且配置正确：

```json
{
  "device_ip": "192.168.0.145",
  "device_port": 5555,
  "log_level": "info",
  "tasks": []
}
```

### Step 3: 首次连接 - 设备授权

第一次连接时，Android TV 会弹出授权提示：

```bash
docker run --rm \
  -v E:/Projects/ATV-Super-Controller/config:/app/config:ro \
  -v E:/Projects/ATV-Super-Controller/adb-keys:/home/atvuser/.android \
  atv-super-controller:latest status
```

**重要**：
- 运行命令后，立即查看 Android TV 屏幕
- 会出现 "允许 USB 调试？" 弹窗（网络连接也显示 USB）
- **勾选"一律允许使用这台计算机进行调试"**
- 点击 **允许**

授权成功后，容器应显示设备已连接。

### Step 4: 验证 ADB 密钥持久化

```bash
ls adb-keys
```

应该看到 `adbkey` 和 `adbkey.pub` 文件。这些密钥确保容器重启后无需重新授权。

### Step 5: 使用 Docker Compose 启动服务

```bash
cd E:\Projects\ATV-Super-Controller
docker-compose up -d
```

### Step 6: 查看容器日志

```bash
docker-compose logs -f
```

应该看到：
- 服务启动日志
- ADB 连接成功日志
- 调度任务加载日志

### Step 7: 验证容器健康状态

```bash
docker ps
```

查看容器状态，`STATUS` 列应显示 `healthy`。

### Step 8: 完整功能测试

#### 8.1 查看设备状态

```bash
docker-compose exec atv-super-controller node src/index.js status
```

#### 8.2 测试命令执行

```bash
docker-compose exec atv-super-controller node src/index.js test wake
```

#### 8.3 验证配置

```bash
docker-compose exec atv-super-controller node src/index.js validate
```

---

## 常见问题排查

### 问题: "Connection refused" 或 "No route to host"

**原因**: TV 网络调试未开启或 IP 地址错误

**解决**:
1. 确认 TV 已开启网络调试
2. 检查 `config/config.json` 中的 IP 地址
3. 尝试从宿主机 ping TV IP

### 问题: "Unauthorized" 设备状态

**原因**: ADB 连接未在 TV 上授权

**解决**:
1. 删除 `adb-keys` 目录内容: `rm adb-keys/*`
2. 重新运行 Step 3 的命令
3. 在 TV 上重新授权（务必勾选"一律允许"）

### 问题: "Device offline"

**原因**: ADB 连接超时或状态异常

**解决**:
```bash
docker-compose restart
```

### 问题: 容器健康检查失败

**原因**: ADB 连接断开或 TV 关机

**解决**:
1. 检查 TV 是否在线
2. 检查 TV 网络调试是否仍然开启
3. 查看容器日志: `docker-compose logs -f`

---

## 验证清单

- [ ] Android TV 网络调试已开启
- [ ] 本地 `node src/index.js status` 连接成功
- [ ] Docker 容器首次连接已授权
- [ ] `adb-keys` 目录包含密钥文件
- [ ] `docker-compose up -d` 启动成功
- [ ] 容器状态显示 `healthy`
- [ ] 日志显示 ADB 连接正常
- [ ] 设备状态查询返回已连接
- [ ] 测试命令执行成功

---

## 重启与维护

### 重启服务

```bash
docker-compose restart
```

### 停止服务

```bash
docker-compose down
```

### 查看实时日志

```bash
docker-compose logs -f --tail=100
```

### 更新镜像后重新部署

```bash
docker build -t atv-super-controller:latest .
docker-compose down
docker-compose up -d
```

---

## 目录结构

```
ATV-Super-Controller/
├── config/                    # 配置文件目录（挂载到容器）
│   └── config.json           # 设备配置和任务定义
├── adb-keys/                 # ADB 密钥目录（挂载到容器）
│   ├── adbkey               # ADB 私钥
│   └── adbkey.pub           # ADB 公钥
├── docker-compose.yml        # Docker Compose 配置
└── Dockerfile                # 镜像构建文件
```
