# P2 实施设计

- 日期：2026-09-02
- 状态：已完成
- 目标：建立本地 Web 应用、匿名临时会话和统一来源导入

## 业务状态

1. 首次打开页面时创建匿名会话，HttpOnly Cookie 仅保存不可预测会话 ID。
2. 会话最后活动 2 小时后过期；刷新可恢复，服务重启可丢失。
3. 无来源时只能上传文件或提交明确 URL，不能进入模型聊天。
4. 一个会话只有一个活动来源；替换必须由前端确认并显式提交 `replace=true`。
5. 导入成功后返回来源元数据、分类、规模、结构摘要和质量告警，不返回完整提取正文。

## 统一来源管线

```text
上传字节 / URL 响应
  -> 协议、大小、扩展名、MIME 与内容特征校验
  -> PDF / Markdown / TXT / HTML 解析器
  -> 统一 ParsedSource
  -> 500,000 字符索引上限与告警
  -> SourceRecord + TTL Session Store
```

原始二进制只存在于当前请求内。HTML 只提取正文，不执行脚本或加载子资源。URL 请求继续使用 P1 的 DNS/IP、重定向、超时、响应大小和内容类型限制。

## API 与错误

- `POST /api/sessions`：创建或返回有效会话。
- `GET /api/sessions/current`：返回可序列化会话状态。
- `POST /api/sources/upload`：接收单文件 `multipart/form-data`。
- `POST /api/sources/import`：接收 `{ url, replace }`。
- 业务错误统一返回 `{ error: { code, message, retryable } }`。
- 非法格式、空内容、扫描 PDF、超限和安全 URL 在创建来源前失败；已有来源不被覆盖。

## P2 验证门槛

- PDF、Markdown、TXT、HTML 文件均可创建统一来源。
- 316 页大书识别为 `book` 并出现索引截断告警。
- 截图型 PDF 显示低文本告警。
- 私网/非法 URL 在发出请求前拒绝。
- Cookie 会话刷新后可恢复，过期与替换状态有自动化测试。
- 页面在无来源、处理中、成功和错误状态下均可操作。
