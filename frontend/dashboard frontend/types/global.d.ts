// Global type declarations for the productivity dashboard

declare global {
  interface Window {
    socket?: {
      on: (event: string, cb: (data: any) => void) => void;
      off: (event: string) => void;
    };
  }
}

export {};
