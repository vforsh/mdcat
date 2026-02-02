export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children?: FileNode[];
}

export interface FileContext {
  root: string;
  is_git: boolean;
}

export type ViewMode = "preview" | "raw";

export interface AppState {
  filePath: string | null;
  content: string;
  mode: ViewMode;
  context: FileContext | null;
  tree: FileNode[];
  dirty: boolean;
}
