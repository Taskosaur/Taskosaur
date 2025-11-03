import { Request, Response, NextFunction } from 'express';
import { join } from 'path';
import * as fs from 'fs';

export class StaticRoutingMiddleware {
  private publicDir: string;
  private fileCache: Map<string, boolean> = new Map();

  constructor(publicDir?: string) {
    if (publicDir) {
      this.publicDir = publicDir;
    } else {
      this.publicDir = this.findPublicDir();
    }
  }

  private findPublicDir(): string {
    let currentDir = __dirname;

    // Try current directory first
    let publicPath = join(currentDir, 'public');
    if (fs.existsSync(publicPath)) {
      return publicPath;
    }

    // Try one directory up
    currentDir = join(currentDir, '..');
    publicPath = join(currentDir, 'public');
    if (fs.existsSync(publicPath)) {
      return publicPath;
    }

    // Try two directories up
    currentDir = join(currentDir, '..');
    publicPath = join(currentDir, 'public');
    if (fs.existsSync(publicPath)) {
      return publicPath;
    }

    // Give up with error
    throw new Error(`Could not find 'public' directory. Searched in:
- ${join(__dirname, 'public')}
- ${join(__dirname, '..', 'public')}
- ${join(__dirname, '..', '..', 'public')}`);
  }

  private fileExists(filePath: string): boolean {
    if (this.fileCache.has(filePath)) {
      return this.fileCache.get(filePath)!;
    }

    const exists = fs.existsSync(filePath);
    this.fileCache.set(filePath, exists);
    return exists;
  }

  private tryServeStatic(res: Response, relativePath: string): boolean {
    const fullPath = join(this.publicDir, relativePath);
    if (this.fileExists(fullPath)) {
      res.sendFile(fullPath);
      return true;
    }
    return false;
  }

  private cleanPath(path: string): string {
    let cleanPath = path;

    // Remove trailing slash except for root
    if (cleanPath !== '/' && cleanPath.endsWith('/')) {
      cleanPath = cleanPath.slice(0, -1);
    }

    // Add leading slash if missing
    if (!cleanPath.startsWith('/')) {
      cleanPath = '/' + cleanPath;
    }

    return cleanPath;
  }

  private generateDynamicPaths(segments: string[], depth: number = 0): string[] {
    if (depth >= segments.length) {
      return [''];
    }

    const currentSegment = segments[depth];
    const remainingPaths = this.generateDynamicPaths(segments, depth + 1);

    const paths: string[] = [];

    // Try with actual segment first (exact match priority)
    for (const remaining of remainingPaths) {
      paths.push('/' + currentSegment + remaining);
    }

    // Try with dynamic segment placeholders
    const dynamicPatterns = ['[workspaceSlug]', '[projectSlug]', '[taskId]', '[slug]'];

    for (const pattern of dynamicPatterns) {
      for (const remaining of remainingPaths) {
        paths.push('/' + pattern + remaining);
      }
    }

    return paths;
  }

  middleware = (req: Request, res: Response, next: NextFunction): void => {
    // Skip if route starts with /api (API routes)
    if (req.path.startsWith('/api')) {
      return next();
    }

    // Skip if route starts with /docs or other backend static routes
    if (req.path.startsWith('/docs')) {
      return next();
    }

    // Skip static files - let express.static handle them
    if (req.path.includes('.') || req.path.startsWith('/_next')) {
      return next();
    }

    // Clean the path for HTML routing
    const cleanPath = this.cleanPath(req.path);

    // Try exact match first
    if (this.tryServeStatic(res, cleanPath + '/index.html')) return;
    if (this.tryServeStatic(res, cleanPath + '.html')) return;

    // Handle dynamic routes by checking path segments
    const pathSegments = cleanPath.split('/').filter(Boolean);

    if (pathSegments.length > 0) {
      // Generate all possible dynamic path combinations
      const dynamicPaths = this.generateDynamicPaths(pathSegments);

      for (const dynamicPath of dynamicPaths) {
        if (this.tryServeStatic(res, dynamicPath + '/index.html')) return;
        if (this.tryServeStatic(res, dynamicPath + '.html')) return;
      }
    }

    // SPA fallback - serve root index.html for unmatched routes
    if (this.tryServeStatic(res, '/index.html')) return;

    // If no static file was found, continue to next middleware
    next();
  };

  clearCache(): void {
    this.fileCache.clear();
  }
}

export const createStaticRoutingMiddleware = (publicDir?: string) => {
  const middleware = new StaticRoutingMiddleware(publicDir);
  return middleware.middleware;
};

export const findPublicDir = (): string => {
  let currentDir = __dirname;

  // Try current directory first
  let publicPath = join(currentDir, 'public');
  if (fs.existsSync(publicPath)) {
    return publicPath;
  }

  // Try one directory up
  currentDir = join(currentDir, '..');
  publicPath = join(currentDir, 'public');
  if (fs.existsSync(publicPath)) {
    return publicPath;
  }

  // Try two directories up
  currentDir = join(currentDir, '..');
  publicPath = join(currentDir, 'public');
  if (fs.existsSync(publicPath)) {
    return publicPath;
  }

  // Give up with error
  throw new Error(`Could not find 'public' directory. Searched in:
- ${join(__dirname, 'public')}
- ${join(__dirname, '..', 'public')}
- ${join(__dirname, '..', '..', 'public')}`);
};
