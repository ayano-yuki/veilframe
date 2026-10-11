export type PlaybackMode = 'normal' | 'hardware';
export type DrmSystem = 'widevine' | 'playready';
export interface PlaybackRequest {
  drm?: DrmSystem;
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
