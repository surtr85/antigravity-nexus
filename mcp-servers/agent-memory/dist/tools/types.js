export function okResult(data) {
    return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        structuredContent: data,
    };
}
//# sourceMappingURL=types.js.map