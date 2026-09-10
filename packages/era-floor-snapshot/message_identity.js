// Generated from Service base_lib/domain; do not edit.
/** 从活动消息正文读取 ERA 消息键。 */
export function messageMk(text) {
    const block = text.match(/<era_data>(\{[\s\S]*?\})<\/era_data>/iu)?.[1];
    return block?.match(/"era-message-key"\s*=\s*"([^"]+)"/u)?.[1] ?? null;
}
