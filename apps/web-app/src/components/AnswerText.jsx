const cx = (...classes) => classes.filter(Boolean).join(" ");

function inline(text) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={index} className="font-semibold text-neutral-950">
        {part.slice(2, -2)}
      </strong>
    ) : (
      part
    ),
  );
}

export default function AnswerText({ text, className }) {
  const blocks = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      blocks.push({ type: "break" });
      continue;
    }
    const bullet = line.match(/^(?:[*+\-•]|\d+[.)])\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.type === "list") last.items.push(bullet[1]);
      else
        blocks.push({
          type: "list",
          ordered: /^\d/.test(line),
          items: [bullet[1]],
        });
    } else if (last?.type === "paragraph") {
      last.text += ` ${line}`;
    } else {
      blocks.push({ type: "paragraph", text: line });
    }
  }

  return (
    <div className={cx("space-y-3 leading-relaxed text-neutral-800", className || "text-[15px]")}>
      {blocks.map((block, index) => {
        if (block.type === "break") return null;
        if (block.type === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={cx(
                "space-y-1.5 pl-5",
                block.ordered ? "list-decimal" : "list-disc marker:text-neutral-400",
              )}
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{inline(item)}</li>
              ))}
            </List>
          );
        }
        return <p key={index}>{inline(block.text)}</p>;
      })}
    </div>
  );
}
