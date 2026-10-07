export const createLineParser = (onObject) => {
  let buffer = "";
  const flush = (line) => {
    const trimmed = line.trim();
    if (trimmed) onObject(JSON.parse(trimmed));
  };
  return {
    push(text) {
      buffer += text;
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        flush(buffer.slice(0, newline));
        buffer = buffer.slice(newline + 1);
        newline = buffer.indexOf("\n");
      }
    },
    end() {
      flush(buffer);
      buffer = "";
    },
  };
};
