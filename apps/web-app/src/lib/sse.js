export const createEventParser = (onEvent) => {
  let buffer = "";
  const dispatch = (block) => {
    let event = "message";
    const data = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length) onEvent(event, JSON.parse(data.join("\n")));
  };
  return {
    push(text) {
      buffer += text.replace(/\r\n/g, "\n");
      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        dispatch(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        boundary = buffer.indexOf("\n\n");
      }
    },
    end() {
      if (buffer.trim()) dispatch(buffer);
      buffer = "";
    },
  };
};
