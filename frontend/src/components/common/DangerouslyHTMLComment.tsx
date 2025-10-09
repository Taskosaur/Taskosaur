export function decodeHtml(html: string) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}

export function DangerouslyHTMLComment({ comment }) {
  const hasEscapedHtml = /&lt;|&gt;/.test(comment);

  const htmlToRender = hasEscapedHtml ? decodeHtml(comment) : comment;

  return (
    <div
      className="
        text-[var(--foreground)] leading-relaxed
        [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-5
        [&_h1]:text-3xl [&_h2]:text-2xl [&_h3]:text-xl
        [&_h4]:text-lg [&_h5]:text-base [&_h6]:text-sm
        [&_blockquote]:border-l-4 [&_blockquote]:border-gray-400
        [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600
        [&_p]:my-1
      "
      dangerouslySetInnerHTML={{ __html: htmlToRender }}
    />
  );
}
