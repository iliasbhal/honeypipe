/**
 * Generic type-safe event emitter base class
 */
export class EventEmitter<EventMap extends Record<string, any>> {
  private eventHandlers: {
    [K in keyof EventMap]: Set<(event: EventMap[K]) => void>
  } = {} as any;

  /**
   * Subscribe to an event
   */
  on<K extends keyof EventMap>(event: K, handler: (event: EventMap[K]) => void) {
    if (!this.eventHandlers[event]) {
      this.eventHandlers[event] = new Set();
    }
    this.eventHandlers[event].add(handler);

    return {
      dispose: () => {
        this.eventHandlers[event]?.delete(handler);
      }
    };
  }

  /**
   * Subscribe to an event once (auto-unsubscribe after first call)
   */
  once<K extends keyof EventMap>(event: K, handler: (event: EventMap[K]) => void) {
    const subscription = this.on(event, (eventData) => {
      handler(eventData);
      subscription.dispose();
    });
    return subscription;
  }

  /**
   * Emit an event
   */
  emit<K extends keyof EventMap>(event: K, eventData: EventMap[K]) {
    this.eventHandlers[event]?.forEach(handler => {
      try {
        handler(eventData);
      } catch (error) {
        console.error(`Error in event handler for '${String(event)}':`, error);
      }
    });
  }

  /**
   * Remove all listeners for a specific event
   */
  off<K extends keyof EventMap>(event: K) {
    this.eventHandlers[event]?.clear();
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners() {
    Object.keys(this.eventHandlers).forEach(event => {
      this.eventHandlers[event as keyof EventMap]?.clear();
    });
  }

  /**
   * Get the number of listeners for an event
   */
  listenerCount<K extends keyof EventMap>(event: K): number {
    return this.eventHandlers[event]?.size || 0;
  }

  /**
   * Get all event names that have listeners
   */
  eventNames(): (keyof EventMap)[] {
    return Object.keys(this.eventHandlers).filter(
      event => this.eventHandlers[event as keyof EventMap]?.size > 0
    );
  }
}