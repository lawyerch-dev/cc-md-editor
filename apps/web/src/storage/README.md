# storage/

统一存储抽象层。封装 localStorage、IndexedDB 等存储后端，提供一致的 API。

## 目录结构

```
storage/
├── index.ts             入口（导出 store 单例）
├── engine.ts            存储引擎抽象接口
├── manager.ts           存储管理器（读写调度）
├── keys.ts              存储键常量
├── prefix.ts            键前缀管理（避免冲突）
├── quota.ts             存储配额检测
├── safe-access.ts       安全读写（try-catch 包装）
├── db.ts                数据库初始化
├── engines/
│   └── indexed-db.ts    IndexedDB 引擎实现
├── repositories/
│   ├── documents.ts     文档仓库（文章 CRUD）
│   └── cache.ts         缓存仓库
└── migrate/
    └── from-local-storage.ts  localStorage → IndexedDB 迁移
```

## 使用方式

```ts
import { store } from '@/storage'

// 响应式存储
const theme = store.reactive<ThemeName>('theme', 'default')

// 异步读写
await store.set('key', value)
const value = await store.get('key')
```
