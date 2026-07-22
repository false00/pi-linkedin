export function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw new DOMException("Operation aborted", "AbortError");
  }
}

export async function emitProgress(onUpdate, message) {
  if (typeof onUpdate !== "function" || !message) {
    return;
  }

  await onUpdate({
    content: [{
      type: "text",
      text: message,
    }],
  });
}

export function createToolError(message, options = {}) {
  const error = new Error(message);
  error.status = options.status ?? 500;
  error.category = options.category ?? "unknown";
  error.guidance = options.guidance ?? null;
  error.retryable = options.retryable ?? false;
  error.details = options.details ?? null;
  return error;
}

export function jsonResult(payload) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(payload, null, 2),
    }],
    details: payload,
  };
}

export function safeExecute(fn) {
  return async (_toolCallId, params, signal, onUpdate, ctx) => {
    try {
      return await fn(params, signal, onUpdate, ctx);
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw createToolError(String(error), {
        status: 500,
        category: "unknown",
        retryable: false,
      });
    }
  };
}
