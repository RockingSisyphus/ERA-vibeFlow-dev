// 仅编码业务值；页面对象、回调及运行资源由Tavern令牌处理。
const FORMAT = 'era-values-v1';
/** @returns {{encoding: 'era-values-v1', payload: string}} */
export function encodePacket(value) {
  const ancestors = new Set();
  function encode(item) {
    if (item === null) return ['null'];
    switch (typeof item) {
      case 'undefined': return ['undefined'];
      case 'string': return ['string', item];
      case 'boolean': return ['boolean', item];
      case 'number': return ['number', Object.is(item, -0) ? '-0' : String(item)];
      case 'bigint': return ['bigint', String(item)];
      case 'object': break;
      default: throw new TypeError('工作流业务消息不能包含函数或符号；运行资源须使用所属实例的资源编号。');
    }
    const array = Array.isArray(item), proto = Object.getPrototypeOf(item);
    const ordinary = proto === null || proto === Object.prototype ||
      Object.getPrototypeOf(proto) === null && Object.getOwnPropertyDescriptor(proto, 'constructor')?.value?.name === 'Object';
    if (!array && !ordinary)
      throw new TypeError('工作流业务消息只接受普通对象和数组；页面资源须使用资源编号。');
    if (ancestors.has(item)) throw new TypeError('工作流业务消息不能包含循环引用。');
    ancestors.add(item);
    try {
      const entries = Object.keys(item).map(key => [key, encode(item[key])]);
      return array ? ['array', item.length, entries] : ['object', proto === null, entries];
    } finally { ancestors.delete(item); }
  }
  return {encoding: FORMAT, payload: JSON.stringify(encode(value))};
}

export function decodePacket(packet) {
  if (packet?.encoding !== FORMAT || typeof packet.payload !== 'string')
    throw new TypeError('工作流消息的数据封装格式不正确。');
  function decode(node) {
    if (!Array.isArray(node)) throw new TypeError('工作流消息的值记录不正确。');
    const [kind, value, entries] = node;
    switch (kind) {
      case 'null': return null;
      case 'undefined': return undefined;
      case 'string':
        if (typeof value !== 'string') throw new TypeError('工作流消息的字符串记录不正确。');
        return value;
      case 'boolean':
        if (typeof value !== 'boolean') throw new TypeError('工作流消息的布尔记录不正确。');
        return value;
      case 'number': {
        if (typeof value !== 'string') throw new TypeError('工作流消息的数值记录不正确。');
        if (value === 'NaN') return NaN;
        if (value === 'Infinity') return Infinity;
        if (value === '-Infinity') return -Infinity;
        if (value === '-0') return -0;
        const number = Number(value);
        if (!Number.isFinite(number) || String(number) !== value)
          throw new TypeError('工作流消息的数值文字不正确。');
        return number;
      }
      case 'bigint': return BigInt(value);
      case 'object':
      case 'array': {
        if (!Array.isArray(entries)) throw new TypeError('工作流消息的对象字段记录不正确。');
        if (kind === 'array' && (!Number.isInteger(value) || value < 0 || value > 4294967295))
          throw new TypeError('工作流消息的数组长度不正确。');
        if (kind === 'object' && typeof value !== 'boolean')
          throw new TypeError('工作流消息的对象类型记录不正确。');
        const result = kind === 'array' ? new Array(value) : Object.create(value ? null : Object.prototype);
        for (const entry of entries) {
          if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string')
            throw new TypeError('工作流消息的字段记录不正确。');
          const [key, encoded] = entry;
          if (Object.hasOwn(result, key)) throw new TypeError('工作流消息包含重复字段。');
          if (kind === 'array' && /^(0|[1-9][0-9]*)$/u.test(key) && Number(key) < 4294967295 && Number(key) >= value)
            throw new TypeError('工作流消息的数组位置超过已声明长度。');
          Object.defineProperty(result, key, {value: decode(encoded), enumerable: true, configurable: true, writable: true});
        }
        return result;
      }
      default: throw new TypeError('工作流消息包含未知的值记录。');
    }
  }
  return decode(JSON.parse(packet.payload));
}
