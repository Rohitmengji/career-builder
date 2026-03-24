/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  var __previewListeners: Set<(slug: string) => void> | undefined;
}

/**
 * GET /api/preview — Server-Sent Events stream for live preview sync.
 *
 * When the editor saves, it notifies this endpoint which pushes
 * an event to all connected web frontends so they reload in real-time.
 *
 * NOTE: This is intentionally open (no auth) because the web app
 * connects to it for live preview. It only sends slug names + timestamps,
 * never sensitive data. Rate limiting at the edge layer protects it.
 */
export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Initialize global listener set (cap at 50 to prevent memory issues)
      if (!globalThis.__previewListeners) {
        globalThis.__previewListeners = new Set();
      }

      // Prevent too many open connections
      if (globalThis.__previewListeners.size >= 50) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: "Too many connections" })}\n\n`));
        controller.close();
        return;
      }

      let heartbeat: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        globalThis.__previewListeners?.delete(listener);
        if (heartbeat) clearInterval(heartbeat);
      };

      const listener = (slug: string) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ slug, timestamp: Date.now() })}\n\n`)
          );
        } catch {
          // Stream closed — clean up
          cleanup();
        }
      };

      globalThis.__previewListeners.add(listener);

      // Send heartbeat every 30s to keep connection alive
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          cleanup();
        }
      }, 30_000);

      // Send initial connection event
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected" })}\n\n`));
    },
    cancel() {
      // Called when the client disconnects — clean up is handled inside start()
      // via try/catch but this ensures the stream resources are freed
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
