# Technical Spike - 验证清单

## 概述

在正式实施 ATV-Scheduler-CLI 之前，必须完成以下验证步骤。

## 前置条件

- [ ] Node.js 18+ 已安装
- [ ] Android TV 设备已开启 ADB over TCP
- [ ] 设备与开发机在同一网络
- [ ] 已更新 `config.mjs` 中的设备 IP

## 如何启用 Android TV 的 ADB over TCP

1. 设置 > 设备偏好设置 > 关于 > 版本号（点击7次启用开发者模式）
2. 设置 > 设备偏好设置 > 开发者选项 > 网络调试（开启）
3. 记录显示的 IP 地址和端口

## 验证步骤

### Step 1: 安装依赖

```bash
cd spike
npm install
```

### Step 2: 更新配置

编辑 `config.mjs`，填入你的设备 IP：

```javascript
export const CONFIG = {
  DEVICE_IP: '你的设备IP',
  DEVICE_PORT: 5555,
  // ...
};
```

### Step 3: 运行验证测试

按顺序执行：

| 测试 | 命令 | 阻塞级别 |
|------|------|----------|
| 01 - 安装验证 | `npm run test:install` | 🔴 阻塞 |
| 02 - 连接测试 | `npm run test:connect` | 🔴 阻塞 |
| 03 - Shell 测试 | `npm run test:shell` | 🔴 阻塞 |
| 04 - YouTube 测试 | `npm run test:youtube` | 🔴 阻塞 |

或一次性运行所有测试：

```bash
npm run test:all
```

## 验证结果记录

### Test 01: adb-kit 安装
- [ ] 通过 / 失败
- 备注: _______________

### Test 02: ADB 连接
- [ ] 通过 / 失败
- 设备型号: _______________
- 备注: _______________

### Test 03: Shell 命令
- [ ] 通过 / 失败
- 唤醒命令有效: 是 / 否
- 备注: _______________

### Test 04: YouTube TV
- [ ] 通过 / 失败
- 发现的包名: _______________
- 推荐启动方式: _______________
- 备注: _______________

## 决策点

全部测试通过后：
- ✅ 继续执行实施计划 Task 1-13

任何测试失败：
- ⚠️ 记录问题并调整实施计划
- ⚠️ 考虑替代方案或技术栈调整
