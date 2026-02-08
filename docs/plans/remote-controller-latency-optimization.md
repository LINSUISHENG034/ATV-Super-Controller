# Remote Controller 按钮延迟优化计划

## 问题分析

### 当前架构
```
[用户点击按钮] → [HTTP POST /api/v1/remote/key] → [等待ADB命令完成] → [返回响应] → [显示Toast]
```

### 延迟来源

| 来源 | 位置 | 预估延迟 |
|------|------|----------|
| HTTP 请求开销 | 前端 → 后端 | 50-100ms |
| JSON 序列化 | 前后端 | 5-10ms |
| ADB shell 命令执行 | `api.js:312-320` | 100-300ms |
| 等待流完成 | `api.js:316-320` | 50-100ms |
| Toast 渲染 | `app.js:574-575` | 10-20ms |
| **总计** | | **215-530ms** |

### 核心问题

1. **同步等待 ADB 流完成** (`src/web/routes/api.js:312-320`)
   ```javascript
   const stream = await device.shell(`input keyevent ${keycode}`);
   await new Promise((resolve, reject) => {
     stream.on('data', () => {});
     stream.on('end', resolve);
     stream.on('error', reject);
   });
   ```
   - 每次按键都等待 ADB 命令完全执行完毕才返回

2. **HTTP REST API 开销**
   - 每次按键都是完整的 HTTP 请求/响应周期
   - 包含 JSON 序列化/反序列化

3. **前端 Toast 通知**
   - 每次按键都显示 Toast，触发 DOM 更新

---

## 优化方案

### 方案 A: WebSocket 实时按键通道 (推荐)

**原理**: 使用现有 WebSocket 连接发送按键事件，避免 HTTP 开销

**优化后架构**:
```
[用户点击按钮] → [WebSocket send] → [Fire-and-forget ADB] → [可选确认]
```

**预期延迟**: 20-50ms

#### 实现步骤

1. **扩展 WebSocket Handler** - 添加 `remote:key` 消息类型
2. **Fire-and-forget ADB** - 不等待命令完成
3. **前端优化** - 移除 Toast，添加视觉反馈

### 方案 B: HTTP Fire-and-Forget

**原理**: 保持 HTTP API，但不等待 ADB 命令完成

**预期延迟**: 50-100ms

### 方案 C: 批量按键队列

**原理**: 收集短时间内的按键，批量发送

**预期延迟**: 取决于批量间隔

---

## 推荐实施: 方案 A (WebSocket)

### 第一阶段: 后端 WebSocket 按键处理

#### 1.1 扩展 WebSocket Handler

**文件**: `src/web/websocket/handler.js`

```javascript
// 新增: 处理 remote:key 消息
case 'remote:key':
  return this._handleRemoteKey(client, message.keycode, clientId);
```

#### 1.2 添加按键处理方法

```javascript
async _handleRemoteKey(client, keycode, clientId) {
  // 验证 keycode
  if (!ALLOWED_KEYCODES.includes(keycode)) {
    return { success: false, error: 'Invalid keycode' };
  }

  // Fire-and-forget: 不等待完成
  const device = getDevice();
  if (!device) {
    return { success: false, error: 'Device disconnected' };
  }

  device.shell(`input keyevent ${keycode}`).catch(err => {
    logger.warn('Key event failed', { keycode, error: err.message });
  });

  return { success: true };
}
```

### 第二阶段: 前端优化

#### 2.1 新增 WebSocket 按键方法

**文件**: `src/web/public/js/app.js`

```javascript
sendKeyEventWs(keycode) {
  if (this.ws?.readyState === WebSocket.OPEN) {
    this.ws.send(JSON.stringify({
      type: 'remote:key',
      keycode
    }));
    // 即时视觉反馈，无需等待响应
    return true;
  }
  // 降级到 HTTP
  return this.sendKeyEvent(keycode);
}
```

#### 2.2 移除 Toast 通知

将 `sendKeyEvent` 中的 Toast 改为可选的视觉反馈（如按钮闪烁）

### 第三阶段: 视觉反馈优化

#### 3.1 CSS 按钮按下效果

```css
.remote-btn:active,
.remote-btn.pressed {
  transform: scale(0.95);
  box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
}
```

#### 3.2 即时反馈（无需等待响应）

```javascript
// 点击时立即添加 pressed 类
// 150ms 后移除
```

---

## 性能对比

| 指标 | 当前 (HTTP) | 优化后 (WebSocket) |
|------|-------------|-------------------|
| 平均延迟 | 300-500ms | 20-50ms |
| 连续按键 | 阻塞 | 流畅 |
| 网络开销 | 高 | 低 |
| 错误处理 | 同步 | 异步日志 |

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| WebSocket 断开 | 降级到 HTTP API |
| 按键丢失 | 可选确认机制 |
| 安全性 | 复用现有 keycode 白名单 |

---

## 实施顺序

1. [x] 后端: 扩展 WebSocket handler 支持 `remote:key`
2. [x] 后端: 实现 fire-and-forget ADB 调用
3. [x] 前端: 添加 `sendKeyEventWs` 方法
4. [x] 前端: 更新按钮点击处理
5. [x] 前端: 移除 Toast，添加视觉反馈
6. [ ] 测试: 验证延迟改善
7. [ ] 文档: 更新 API 文档

---

## 备选: 快速修复 (HTTP Fire-and-Forget)

如果不想修改 WebSocket，可以快速修改 HTTP API:

**文件**: `src/web/routes/api.js:311-320`

```javascript
// 修改前: 等待完成
const stream = await device.shell(`input keyevent ${keycode}`);
await new Promise((resolve, reject) => {
  stream.on('data', () => {});
  stream.on('end', resolve);
  stream.on('error', reject);
});

// 修改后: Fire-and-forget
device.shell(`input keyevent ${keycode}`).catch(err => {
  logger.warn('Key event failed', { keycode, error: err.message });
});
// 立即返回，不等待
```

**预期改善**: 延迟从 300-500ms 降至 50-100ms
