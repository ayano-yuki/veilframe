export type PlaybackMode = 'normal' | 'hardware';
export interface PlaybackRequest {
  manifestUrl: string;
  licenseUrl: string;
  mode: PlaybackMode;
  serverCertificateUrl?: string;
}
export interface PlaybackPort {
  load(video: HTMLVideoElement, request: PlaybackRequest): Promise<void>;
  destroy(): Promise<void>;
}
export type PlaybackState =
  'idle' | 'loading' | 'playing' | 'failed' | 'unsupported';
