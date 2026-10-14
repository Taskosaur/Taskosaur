import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { ROLES_KEY } from '../../common/decorator/roles.decorator';
import { SCOPE_KEY } from '../../common/decorator/scope.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
export type DocumentScope = 'organization' | 'workspace' | 'project';
export interface DocumentReference {
  scope: DocumentScope;
  ownerId: string;
  path: string;
}
export interface DocumentsUser {
  id: string;
  role?: string;
}
interface StoredSource {
  projectId?: string;
  scope?: DocumentScope;
  ownerId?: string;
  root: string;
  label: string;
  entrypoint: string;
  taskLinks?: Record<string, (string | DocumentReference)[]>;
  legacyRedirects?: Record<string, DocumentReference>;
}
interface Source {
  scope: DocumentScope;
  ownerId: string;
  root: string;
  label: string;
  entrypoint: string;
  raw: StoredSource;
}
interface Owner {
  scope: DocumentScope;
  ownerId: string;
  ownerName: string;
}
interface DocumentMetadata {
  title?: string;
  subjects?: string[];
  category?: 'Coordination' | 'Guidance' | 'Knowledge' | 'Capabilities' | 'Operations';
}
const MAX_BYTES = 200 * 1024;
@Injectable()
export class DocumentsService {
  private readonly locks = new Map<string, Promise<unknown>>();
  private readonly roles: RolesGuard;
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.roles = new RolesGuard(new Reflector(), prisma);
  }
  private async serial<T>(key: string, action: () => Promise<T>): Promise<T> {
    const pending = (this.locks.get(key) ?? Promise.resolve()).catch(() => undefined).then(action);
    this.locks.set(key, pending);
    try {
      return await pending;
    } finally {
      if (this.locks.get(key) === pending) this.locks.delete(key);
    }
  }
  private configPath(): string {
    const value = this.config.get<string>('TASKOSAUR_DOCS_CONFIG');
    if (!value || !path.isAbsolute(value))
      throw new ServiceUnavailableException('Project documents are not configured');
    return value;
  }
  private async boundedRead(file: string, limit = MAX_BYTES): Promise<string> {
    const handle = await fs.open(file, 'r');
    try {
      const stat = await handle.stat();
      if (!stat.isFile() || stat.size > limit)
        throw new BadRequestException('Document exceeds size limit');
      const buffer = Buffer.alloc(limit + 1);
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
      if (bytesRead > limit) throw new BadRequestException('Document exceeds size limit');
      return buffer.subarray(0, bytesRead).toString('utf8');
    } finally {
      await handle.close();
    }
  }
  private async sources(): Promise<Source[]> {
    try {
      const value: unknown = JSON.parse(await this.boundedRead(this.configPath(), 1024 * 1024));
      if (!Array.isArray(value)) throw new Error('Invalid config');
      const sources = value.map((raw: StoredSource): Source => {
        const legacy = raw && raw.scope === undefined && raw.ownerId === undefined;
        const scope = legacy ? 'project' : raw?.scope;
        const ownerId = legacy ? raw?.projectId : raw?.ownerId;
        if (
          !raw ||
          !this.validScope(scope) ||
          typeof ownerId !== 'string' ||
          !ownerId ||
          (raw.projectId !== undefined && (scope !== 'project' || raw.projectId !== ownerId)) ||
          typeof raw.root !== 'string' ||
          !path.isAbsolute(raw.root) ||
          typeof raw.label !== 'string' ||
          !this.allowed(raw.entrypoint) ||
          (raw.legacyRedirects !== undefined &&
            (!raw.legacyRedirects ||
              typeof raw.legacyRedirects !== 'object' ||
              Array.isArray(raw.legacyRedirects) ||
              Object.keys(raw.legacyRedirects).length > 500 ||
              Object.entries(raw.legacyRedirects).some(
                ([key, target]) => !this.allowed(key) || !this.validReference(target),
              ))) ||
          (raw.taskLinks !== undefined &&
            (!raw.taskLinks ||
              typeof raw.taskLinks !== 'object' ||
              Array.isArray(raw.taskLinks) ||
              Object.values(raw.taskLinks).some(
                (links) =>
                  !Array.isArray(links) ||
                  links.length > 50 ||
                  links.some((link) =>
                    typeof link === 'string' ? !this.allowed(link) : !this.validReference(link),
                  ),
              )))
        )
          throw new Error('Invalid config');
        return {
          scope,
          ownerId,
          root: raw.root,
          label: raw.label,
          entrypoint: raw.entrypoint,
          raw,
        };
      });
      if (new Set(sources.map((source) => this.ownerKey(source))).size !== sources.length)
        throw new Error('Duplicate document owner');
      // Canonical roots also catch aliases/junctions that point at another owner's files.
      const roots = (await Promise.all(sources.map((source) => fs.realpath(source.root))))
        .map((root) => {
          const canonical = process.platform === 'win32' ? root.toLowerCase() : root;
          return canonical.endsWith(path.sep) ? canonical : canonical + path.sep;
        })
        .sort();
      for (let index = 1; index < roots.length; index++) {
        const relative = path.relative(roots[index - 1], roots[index]);
        if (
          !relative ||
          (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))
        )
          throw new Error('Document source roots must not overlap');
      }
      return sources;
    } catch {
      throw new ServiceUnavailableException(
        'Project documents configuration is unavailable or invalid',
      );
    }
  }
  private async source(ownerId: string, scope: DocumentScope = 'project'): Promise<Source> {
    const source = (await this.sources()).find(
      (item) => item.scope === scope && item.ownerId === ownerId,
    );
    if (!source) throw new NotFoundException(`No document source configured for this ${scope}`);
    return source;
  }
  private validScope(scope: unknown): scope is DocumentScope {
    return scope === 'organization' || scope === 'workspace' || scope === 'project';
  }
  private async documentTarget(
    source: Source,
    relative: string,
    user?: DocumentsUser,
    write = false,
  ) {
    if (!this.allowed(relative)) throw new BadRequestException('Invalid document path');
    const redirect = source.raw.legacyRedirects?.[relative];
    if (!redirect) return { source, relative };
    const target = await this.source(redirect.ownerId, redirect.scope);
    const sourceOrg = (await this.owners(source.scope, source.ownerId)).find(
      (owner) => owner.scope === 'organization',
    );
    const targetOrg = (await this.owners(target.scope, target.ownerId)).find(
      (owner) => owner.scope === 'organization',
    );
    if (
      !sourceOrg ||
      !targetOrg ||
      sourceOrg.ownerId !== targetOrg.ownerId ||
      target.raw.legacyRedirects?.[redirect.path]
    )
      throw new BadRequestException('Invalid legacy document destination');
    if (
      !user ||
      !(await this.permitted(source, user, write)) ||
      !(await this.permitted(target, user, write))
    )
      throw new ForbiddenException('Document destination is not accessible');
    return { source: target, relative: redirect.path, canonicalReference: redirect };
  }
  private validReference(value: unknown): value is DocumentReference {
    if (!value || typeof value !== 'object') return false;
    const reference = value as DocumentReference;
    return (
      this.validScope(reference.scope) &&
      typeof reference.ownerId === 'string' &&
      !!reference.ownerId &&
      this.allowed(reference.path)
    );
  }
  private ownerKey(owner: { scope: DocumentScope; ownerId: string }): string {
    return JSON.stringify([owner.scope, owner.ownerId]);
  }
  private async permitted(
    owner: Owner | Source,
    user: DocumentsUser,
    write = false,
  ): Promise<boolean> {
    const handler = () => undefined;
    Reflect.defineMetadata(ROLES_KEY, [write ? Role.MEMBER : Role.VIEWER], handler);
    Reflect.defineMetadata(
      SCOPE_KEY,
      { type: owner.scope.toUpperCase(), idParam: 'ownerId' },
      handler,
    );
    const context = {
      getHandler: () => handler,
      getClass: () => DocumentsService,
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          params: { ownerId: owner.ownerId },
          method: write ? 'PUT' : 'GET',
        }),
      }),
    } as unknown as ExecutionContext;
    try {
      return await this.roles.canActivate(context);
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return false;
      throw error;
    }
  }
  private async owners(scope: DocumentScope, ownerId: string): Promise<Owner[]> {
    const owners: Owner[] = [];
    let workspaceId: string | null = null;
    let organizationId: string | null = scope === 'organization' ? ownerId : null;
    if (scope === 'project') {
      const project = await this.prisma.project.findUnique({
        where: { id: ownerId },
        select: { name: true, workspaceId: true },
      });
      if (!project) throw new NotFoundException('Project not found');
      owners.push({ scope, ownerId, ownerName: project.name });
      workspaceId = project.workspaceId;
    } else if (scope === 'workspace') workspaceId = ownerId;
    const seen = new Set<string>();
    while (workspaceId && seen.size < 16 && !seen.has(workspaceId)) {
      seen.add(workspaceId);
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true, organizationId: true, parentWorkspaceId: true },
      });
      if (!workspace) {
        if (scope === 'workspace' && workspaceId === ownerId)
          throw new NotFoundException('Workspace not found');
        break;
      }
      if (organizationId && organizationId !== workspace.organizationId) break;
      organizationId = workspace.organizationId;
      owners.push({ scope: 'workspace', ownerId: workspaceId, ownerName: workspace.name });
      workspaceId = workspace.parentWorkspaceId;
    }
    if (organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { name: true },
      });
      if (!organization && scope === 'organization')
        throw new NotFoundException('Organization not found');
      if (organization)
        owners.push({
          scope: 'organization',
          ownerId: organizationId,
          ownerName: organization.name,
        });
    }
    return owners;
  }
  async listSources(
    scope: DocumentScope,
    ownerId: string,
    user: DocumentsUser,
    query = '',
    includeChildren = false,
  ) {
    const sources = await this.sources();
    const ancestors = await this.owners(scope, ownerId);
    const candidates = ancestors.map((owner, index) => ({
      owner,
      lineage: ancestors.slice(index).reverse(),
    }));
    // Explicit migration destinations are available only to readers of both homes.
    const localSource = sources.find(
      (source) => source.scope === scope && source.ownerId === ownerId,
    );
    if (localSource && (await this.permitted(localSource, user))) {
      for (const relative of Object.keys(localSource.raw.legacyRedirects || {})) {
        try {
          const target = await this.documentTarget(localSource, relative, user);
          if (candidates.some(({ owner }) => this.ownerKey(owner) === this.ownerKey(target.source)))
            continue;
          const lineage = await this.owners(target.source.scope, target.source.ownerId);
          candidates.push({ owner: lineage[0], lineage: lineage.reverse() });
        } catch (error) {
          if (error instanceof ForbiddenException || error instanceof NotFoundException) continue;
          throw error;
        }
      }
    }
    if (includeChildren && scope !== 'project') {
      const organization = ancestors.find((owner) => owner.scope === 'organization');
      for (const source of sources) {
        if (
          source.scope === 'organization' ||
          candidates.some(({ owner }) => this.ownerKey(owner) === this.ownerKey(source))
        )
          continue;
        let lineage: Owner[];
        try {
          lineage = await this.owners(source.scope, source.ownerId);
        } catch (error) {
          if (error instanceof NotFoundException) continue;
          throw error;
        }
        if (
          !organization ||
          !lineage.some((owner) => this.ownerKey(owner) === this.ownerKey(organization)) ||
          !lineage.some((owner) => owner.scope === scope && owner.ownerId === ownerId)
        )
          continue;
        candidates.push({ owner: lineage[0], lineage: lineage.reverse() });
      }
    }
    const groups: (Owner &
      Awaited<ReturnType<DocumentsService['list']>> & {
        canEdit: boolean;
        lineage: Owner[];
      })[] = [];
    for (const { owner, lineage } of candidates) {
      const source = sources.find((item) => this.ownerKey(item) === this.ownerKey(owner));
      if (!source || !(await this.permitted(owner, user))) continue;
      const readableLineage: Owner[] = [];
      for (const ancestor of lineage) {
        if (await this.permitted(ancestor, user)) readableLineage.push(ancestor);
      }
      groups.push({
        ...owner,
        ...(await this.listSource(source, query)),
        canEdit: await this.permitted(owner, user, true),
        lineage: readableLineage,
      });
    }
    return { sources: groups };
  }
  private allowed(relative: string): boolean {
    return (
      typeof relative === 'string' &&
      relative.length > 0 &&
      relative.length <= 500 &&
      !path.isAbsolute(relative) &&
      !relative.includes('\\') &&
      !relative.includes(':') &&
      !relative.includes('\0') &&
      path.extname(relative).toLowerCase() === '.md' &&
      relative
        .split('/')
        .every(
          (part) =>
            !!part &&
            !part.startsWith('.') &&
            !/^(node_modules|secrets?|credentials?)(\.|$)/i.test(part),
        )
    );
  }
  private async resolve(source: Source, relative: string): Promise<string> {
    if (!this.allowed(relative))
      throw new BadRequestException('Only Markdown paths within the configured source are allowed');
    const root = await fs.realpath(source.root);
    const target = path.resolve(root, relative);
    const inside = path.relative(root, target);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside))
      throw new BadRequestException('Invalid document path');
    let current = root;
    try {
      for (const segment of relative.split('/')) {
        current = path.join(current, segment);
        if ((await fs.lstat(current)).isSymbolicLink())
          throw new BadRequestException('Document symlinks are not allowed');
      }
      const real = await fs.realpath(target);
      const realRelative = path.relative(root, real);
      if (realRelative.startsWith('..') || path.isAbsolute(realRelative))
        throw new BadRequestException('Invalid document path');
      return real;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new NotFoundException('Document not found');
      throw error;
    }
  }
  private metadata(content: string): DocumentMetadata {
    // Only a bounded first-line comment is metadata; the Markdown body stays authoritative.
    const firstLine = content.slice(0, 8193).split(/\r?\n/, 1)[0];
    if (Buffer.byteLength(firstLine, 'utf8') > 8192) return {};
    const json = /^\uFEFF?<!-- taskosaur: (\{.*\}) -->$/.exec(firstLine)?.[1];
    if (!json) return {};
    try {
      const value: unknown = JSON.parse(json);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      const { title, subjects, category } = value as Record<string, unknown>;
      const metadata: DocumentMetadata = {};
      if (typeof title === 'string' && title.trim() && title.length <= 200)
        metadata.title = title.trim();
      if (
        Array.isArray(subjects) &&
        subjects.length <= 16 &&
        subjects.every(
          (subject) => typeof subject === 'string' && subject.trim() && subject.length <= 200,
        )
      )
        metadata.subjects = subjects.map((subject: string) => subject.trim());
      if (
        ['Coordination', 'Guidance', 'Knowledge', 'Capabilities', 'Operations'].includes(
          category as string,
        )
      )
        metadata.category = category as DocumentMetadata['category'];
      return metadata;
    } catch {
      return {};
    }
  }
  private result(relative: string, content: string) {
    const metadata = this.metadata(content);
    return {
      path: relative,
      ...metadata,
      title:
        metadata.title ||
        /^#\s+(.+)$/m.exec(content)?.[1]?.trim() ||
        path.posix.basename(relative, '.md'),
      content,
      revision: createHash('sha256').update(content).digest('hex'),
    };
  }
  async create(ownerId: string, relative: string, title: string, scope: DocumentScope = 'project') {
    if (
      !this.allowed(relative) ||
      relative.split('/').length > 17 ||
      relative
        .split('/')
        .some(
          (part) =>
            /[. ]$|[<>"|?*]/.test(part) ||
            [...part].some((character) => character.charCodeAt(0) < 32) ||
            /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(part),
        )
    )
      throw new BadRequestException('Invalid document path or folder depth');
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.length > 200 ||
      /[\r\n\u2028\u2029]/.test(title)
    )
      throw new BadRequestException('Title must be one nonempty line of at most 200 characters');
    const source = await this.source(ownerId, scope);
    if (source.raw.legacyRedirects?.[relative])
      throw new ConflictException('This path belongs to a moved document');
    const root = await fs.realpath(source.root);
    const file = path.resolve(root, relative);
    const inside = path.relative(root, file);
    if (!inside || inside.startsWith('..') || path.isAbsolute(inside))
      throw new BadRequestException('Invalid document path');
    return this.serial(process.platform === 'win32' ? file.toLowerCase() : file, async () => {
      let directory = root;
      for (const segment of relative.split('/').slice(0, -1)) {
        directory = path.join(directory, segment);
        try {
          await fs.mkdir(directory);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        }
        const stat = await fs.lstat(directory);
        if (stat.isSymbolicLink() || !stat.isDirectory())
          throw new BadRequestException('Document folders must be ordinary directories');
        const realRelative = path.relative(root, await fs.realpath(directory));
        if (realRelative.startsWith('..') || path.isAbsolute(realRelative))
          throw new BadRequestException('Invalid document folder');
      }
      const content = `# ${title.trim()}\n`;
      try {
        await fs.writeFile(file, content, { flag: 'wx', mode: 0o600 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
          throw new ConflictException('A document already exists at this path');
        throw error;
      }
      return this.result(relative, content);
    });
  }
  async read(
    ownerId: string,
    relative: string,
    scope: DocumentScope = 'project',
    user?: DocumentsUser,
  ) {
    const target = await this.documentTarget(await this.source(ownerId, scope), relative, user);
    return {
      ...this.result(
        target.relative,
        await this.boundedRead(await this.resolve(target.source, target.relative)),
      ),
      ...(target.canonicalReference ? { canonicalReference: target.canonicalReference } : {}),
    };
  }
  async list(ownerId: string, query = '', scope: DocumentScope = 'project') {
    return this.listSource(await this.source(ownerId, scope), query);
  }
  private async listSource(source: Source, query: string) {
    const root = await fs.realpath(source.root);
    const documents: (DocumentMetadata & { path: string; title: string })[] = [];
    let visited = 0;
    let truncated = false;
    let scannedBytes = 0;
    const scan = async (directory: string, prefix: string, depth: number): Promise<void> => {
      if (depth > 16) {
        truncated = true;
        return;
      }
      const dir = await fs.opendir(directory);
      for await (const entry of dir) {
        if (++visited > 5000 || documents.length >= 500 || scannedBytes >= 8 * 1024 * 1024) {
          truncated = true;
          break;
        }
        if (
          entry.name.startsWith('.') ||
          /^(node_modules|secrets?|credentials?)(\.|$)/i.test(entry.name) ||
          entry.isSymbolicLink()
        )
          continue;
        const relative = prefix + entry.name;
        if (entry.isDirectory())
          await scan(path.join(directory, entry.name), relative + '/', depth + 1);
        else if (entry.isFile() && this.allowed(relative)) {
          try {
            const content = await this.boundedRead(await this.resolve(source, relative));
            scannedBytes += Buffer.byteLength(content);
            const result = this.result(relative, content);
            if (
              !query ||
              [relative, content, result.title, ...(result.subjects ?? [])]
                .join('\n')
                .toLowerCase()
                .includes(query.toLowerCase())
            ) {
              documents.push({
                path: relative,
                title: result.title,
                ...(result.subjects !== undefined ? { subjects: result.subjects } : {}),
                ...(result.category ? { category: result.category } : {}),
              });
            }
          } catch {
            truncated = true;
          }
        }
      }
    };
    await scan(root, '', 0);
    documents.sort((a, b) => a.path.localeCompare(b.path));
    return { label: source.label, entrypoint: source.entrypoint, documents, truncated };
  }
  private async atomicWrite(file: string, content: string) {
    const temporary = path.join(path.dirname(file), `.${path.basename(file)}.${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, content, { flag: 'wx', mode: (await fs.stat(file)).mode });
      await fs.rename(temporary, file);
    } finally {
      await fs.unlink(temporary).catch(() => undefined);
    }
  }
  async save(
    ownerId: string,
    relative: string,
    content: string,
    revision: string,
    scope: DocumentScope = 'project',
    user?: DocumentsUser,
  ) {
    if (Buffer.byteLength(content) > MAX_BYTES)
      throw new BadRequestException('Document exceeds 200 KiB limit');
    const target = await this.documentTarget(
      await this.source(ownerId, scope),
      relative,
      user,
      true,
    );
    const source = target.source;
    relative = target.relative;
    const file = await this.resolve(source, relative);
    return this.serial(process.platform === 'win32' ? file.toLowerCase() : file, async () => {
      const current = this.result(
        relative,
        await this.boundedRead(await this.resolve(source, relative)),
      );
      if (revision !== current.revision)
        throw new ConflictException('Document changed. Reload before saving.');
      await this.atomicWrite(file, content);
      return this.result(relative, content);
    });
  }
  private async verifyTask(projectId: string, taskId: string) {
    if (
      !(await this.prisma.task.findFirst({
        where: { id: taskId, projectId },
        select: { id: true },
      }))
    )
      throw new NotFoundException('Task not found in this project');
  }
  private references(source: Source, taskId: string): DocumentReference[] {
    return (source.raw.taskLinks?.[taskId] ?? []).map((link) =>
      typeof link === 'string'
        ? { scope: source.scope, ownerId: source.ownerId, path: link }
        : link,
    );
  }
  private linkResult(projectId: string, references: DocumentReference[]) {
    return {
      paths: references
        .filter((reference) => reference.scope === 'project' && reference.ownerId === projectId)
        .map((reference) => reference.path),
      references,
    };
  }
  private async readableOwners(projectId: string, user?: DocumentsUser): Promise<Set<string>> {
    if (!user) return new Set([this.ownerKey({ scope: 'project', ownerId: projectId })]);
    const readable = new Set<string>();
    for (const owner of await this.owners('project', projectId)) {
      if (await this.permitted(owner, user)) readable.add(this.ownerKey(owner));
    }
    return readable;
  }
  private async canReference(
    source: Source,
    reference: DocumentReference,
    readable: Set<string>,
    user?: DocumentsUser,
  ) {
    try {
      if (readable.has(this.ownerKey(reference))) {
        const target = await this.source(reference.ownerId, reference.scope);
        await this.documentTarget(target, reference.path, user);
        return true;
      }
      const alias = Object.entries(source.raw.legacyRedirects || {}).find(
        ([, target]) =>
          target.scope === reference.scope &&
          target.ownerId === reference.ownerId &&
          target.path === reference.path,
      );
      if (!alias) return false;
      await this.documentTarget(source, alias[0], user);
      return true;
    } catch (error) {
      if (error instanceof ForbiddenException || error instanceof NotFoundException) return false;
      throw error;
    }
  }
  async links(projectId: string, taskId: string, user?: DocumentsUser) {
    await this.verifyTask(projectId, taskId);
    const source = (await this.sources()).find(
      (item) => item.scope === 'project' && item.ownerId === projectId,
    );
    if (!source) return this.linkResult(projectId, []);
    const readable = await this.readableOwners(projectId, user);
    const references: DocumentReference[] = [];
    for (const reference of this.references(source, taskId)) {
      if (await this.canReference(source, reference, readable, user)) references.push(reference);
    }
    return this.linkResult(projectId, references);
  }
  async saveLinks(projectId: string, taskId: string, paths: string[], user?: DocumentsUser) {
    if (
      !Array.isArray(paths) ||
      paths.length > 50 ||
      paths.some((relative) => !this.allowed(relative))
    )
      throw new BadRequestException('Provide at most 50 valid Markdown paths');
    return this.updateLinks(
      projectId,
      taskId,
      paths.map((relative) => ({ scope: 'project', ownerId: projectId, path: relative })),
      user,
      true,
    );
  }
  async saveReferences(
    projectId: string,
    taskId: string,
    references: DocumentReference[],
    user: DocumentsUser,
  ) {
    if (
      !Array.isArray(references) ||
      references.length > 50 ||
      references.some((reference) => !this.validReference(reference))
    )
      throw new BadRequestException('Provide at most 50 valid document references');
    return this.updateLinks(projectId, taskId, references, user, false);
  }
  private async updateLinks(
    projectId: string,
    taskId: string,
    references: DocumentReference[],
    user: DocumentsUser | undefined,
    localOnly: boolean,
  ) {
    await this.verifyTask(projectId, taskId);
    return this.serial(this.configPath(), async () => {
      const sources = await this.sources();
      const source = sources.find((item) => item.scope === 'project' && item.ownerId === projectId);
      if (!source) throw new NotFoundException('No document source configured for this project');
      const readable = await this.readableOwners(projectId, user);
      const unique = [
        ...new Map(
          references.map((reference) => [
            JSON.stringify([reference.scope, reference.ownerId, reference.path]),
            reference,
          ]),
        ).values(),
      ];
      for (const reference of unique) {
        if (!(await this.canReference(source, reference, readable, user)))
          throw new ForbiddenException(
            'Document source is not a readable ancestor of this task project',
          );
        const target = sources.find((item) => this.ownerKey(item) === this.ownerKey(reference));
        if (!target)
          throw new NotFoundException('No document source configured for this reference');
        const destination = await this.documentTarget(target, reference.path, user);
        await this.boundedRead(await this.resolve(destination.source, destination.relative));
      }
      const retained: DocumentReference[] = [];
      for (const reference of this.references(source, taskId)) {
        if (
          localOnly
            ? reference.scope !== 'project' || reference.ownerId !== projectId
            : !(await this.canReference(source, reference, readable, user))
        )
          retained.push(reference);
      }
      const next = [...retained, ...unique];
      if (next.length > 50)
        throw new BadRequestException('A task can have at most 50 document references');
      source.raw.taskLinks = { ...source.raw.taskLinks, [taskId]: next };
      const content =
        JSON.stringify(
          sources.map((item) => item.raw),
          null,
          2,
        ) + '\n';
      if (Buffer.byteLength(content) > 1024 * 1024)
        throw new BadRequestException('Document link configuration is full');
      await this.atomicWrite(this.configPath(), content);
      const visible: DocumentReference[] = [];
      for (const reference of next) {
        if (await this.canReference(source, reference, readable, user)) visible.push(reference);
      }
      return this.linkResult(projectId, visible);
    });
  }
}
