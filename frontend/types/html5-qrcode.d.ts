declare module "html5-qrcode" {
  export const Html5Qrcode: new (elementId: string) => {
    start: (
      cameraConfig: unknown,
      qrboxConfig: unknown,
      qrDetectedCallback: (decodedText: string) => void,
      errorCallback?: () => void
    ) => Promise<void> | void;
    stop?: () => void;
  };
}
