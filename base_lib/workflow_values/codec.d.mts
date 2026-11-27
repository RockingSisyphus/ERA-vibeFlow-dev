/** 跨工作流纯数据包；恢复时保留undefined、负零和稀疏数组等原值。 */
export interface ValuePacket { readonly encoding: "era-values-v1"; readonly payload: string; }
export function encodePacket(value: unknown): ValuePacket;
export function decodePacket(packet: unknown): any;
