# worker/

Cloudflare Worker 代理，用于解决微信公众号 API 的跨域问题。

## 作用

浏览器无法直接调用微信 API（`api.weixin.qq.com`），因为会被 CORS 拦截。这个 Worker 作为中间层：

```
浏览器 → Worker → api.weixin.qq.com
       ← (加 CORS 头) ←
```

## 工作原理

1. 接收浏览器请求，保留路径和参数
2. 转发到 `https://api.weixin.qq.com` 对应路径
3. 在响应中添加 `Access-Control-Allow-Origin: *` 等 CORS 头
4. 返回给浏览器

## 使用场景

- 公众号 access_token 获取
- 公众号素材上传
- 其他需要调用微信开放 API 的功能

## 部署

此 Worker 通过 Cloudflare Workers 部署，独立于 Vue 应用。与 `src/` 中的代码无关。
