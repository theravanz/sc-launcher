export interface LaunchProgress {
  stage: string;
  percent: number;
  message: string;
}

export interface LauncherState {
  isLaunching: boolean;
  progress: number;
  message: string;
  error: string | null;
}