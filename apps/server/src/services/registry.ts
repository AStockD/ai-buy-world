export interface IService {
  name: string;
  init(): Promise<void>;
  destroy(): Promise<void>;
}

export class ServiceRegistry {
  private services = new Map<string, IService>();
  private initialized = false;

  register(service: IService): void {
    if (this.initialized) {
      throw new Error(`Cannot register "${service.name}" after initAll() has been called`);
    }
    this.services.set(service.name, service);
  }

  async initAll(): Promise<void> {
    for (const svc of this.services.values()) {
      await svc.init();
    }
    this.initialized = true;
  }

  async destroyAll(): Promise<void> {
    const reversed = [...this.services.values()].reverse();
    for (const svc of reversed) {
      await svc.destroy();
    }
    this.initialized = false;
  }

  get<T extends IService>(name: string): T {
    const svc = this.services.get(name);
    if (!svc) throw new Error(`Service "${name}" not registered`);
    return svc as T;
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  list(): string[] {
    return [...this.services.keys()];
  }
}

export const serviceRegistry = new ServiceRegistry();

class StatelessServiceAdapter implements IService {
  constructor(
    public name: string,
    private onInit?: () => Promise<void>,
    private onDestroy?: () => Promise<void>,
  ) {}

  async init() {
    if (this.onInit) await this.onInit();
  }

  async destroy() {
    if (this.onDestroy) await this.onDestroy();
  }
}

export function createServiceAdapter(
  name: string,
  onInit?: () => Promise<void>,
  onDestroy?: () => Promise<void>,
): IService {
  return new StatelessServiceAdapter(name, onInit, onDestroy);
}
