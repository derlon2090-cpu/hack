function escapeFilter(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

export function buildVideoFilter(background: string, caption?: string, fontFile?: string) {
  const filters = ["scale=720:1280:force_original_aspect_ratio=decrease", `pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=0x${background}`, "format=yuv420p"];
  if (caption?.trim()) {
    if (!fontFile) throw new Error("A font file is required for video captions.");
    filters.splice(2, 0, `drawtext=fontfile='${escapeFilter(fontFile)}':text='${escapeFilter(caption.trim())}':fontcolor=white:fontsize=36:x=(w-text_w)/2:y=h*0.84:box=1:boxcolor=black@0.42:boxborderw=18`);
  }
  return filters.join(",");
}

export function videoArguments(input: string, output: string, duration: number, background: string, caption?: string, fontFile?: string) {
  if (![3, 5, 10].includes(duration) || !/^[0-9A-F]{6}$/i.test(background)) throw new Error("Invalid video configuration.");
  return ["-hide_banner", "-loglevel", "error", "-y", "-loop", "1", "-i", input, "-vf", buildVideoFilter(background, caption, fontFile), "-t", String(duration), "-an", "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-threads", "2", output];
}
