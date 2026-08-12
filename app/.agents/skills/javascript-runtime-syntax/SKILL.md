---
name: javascript-runtime-syntax
description: 当代码将被直接粘贴到酒馆助手或其他纯 JavaScript 运行环境时，检查并移除 TypeScript 类型语法，避免 Unexpected token ':' 等解析错误。
---

# 纯 JavaScript 运行时语法

本仓库源码使用 TypeScript，并由 Webpack 编译后运行；但直接粘贴进酒馆助手脚本库的代码由浏览器按 JavaScript 解析。

因此，只有经构建流程处理的 `.ts` 文件才能使用类型注解。要提供可直接粘贴运行的 JavaScript 示例时，不得包含参数类型、变量类型、接口、类型别名、`as` 断言等 TypeScript 专属语法。

错误示例：

```javascript
function logMessage(message: string) {
  console.log(message);
}
```

可直接运行的写法：

```javascript
function logMessage(message) {
  console.log(message);
}
```

遇到 `Unexpected token ':'` 时，先确认代码是否绕过了本仓库构建流程，再检查是否误把 TypeScript 源码当成 JavaScript 执行。
