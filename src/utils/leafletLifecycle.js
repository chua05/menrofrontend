export function createLeafletResizeScheduler({
  requestFrame = (callback) => window.requestAnimationFrame(callback),
  cancelFrame = (handle) => window.cancelAnimationFrame(handle),
} = {}) {
  let frame = null;
  let disposed = false;

  const cancel = () => {
    if (frame !== null) cancelFrame(frame);
    frame = null;
  };

  return {
    schedule(instance, isCurrent) {
      cancel();
      if (disposed || !instance) return;
      frame = requestFrame(() => {
        frame = null;
        const container = instance.getContainer?.();
        if (
          disposed ||
          !isCurrent() ||
          !container ||
          container.isConnected === false
        ) return;
        instance.invalidateSize({ animate: false });
      });
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
