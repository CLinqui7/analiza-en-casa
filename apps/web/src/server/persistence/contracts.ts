import type {
  Doctor,
  Hospitalization,
  NursingResource,
  OperationsSnapshot,
  Patient,
  Shift,
} from '@analiza/contracts';
import type { AuthService } from '../auth-service';
import type { ServerActor } from '../validation/patients';
import type { FileMetadata, FileOwnerType, PrivateFileUpload } from '../validation/files';
import type { WorkspaceSnapshot } from '@/lib/data-provider';
import type { WorkspaceSetup } from '@/lib/workspace-setup';
import type { NurseProfile } from '@/lib/nurse-profile';

export interface EntityRepository<T, Key extends string> {
  listWithVersions(actor: ServerActor): Promise<Array<Record<Key, T> & { version: number }>>;
  get(actor: ServerActor, id: string): Promise<T | null>;
  create(actor: ServerActor, input: unknown): Promise<T>;
  replace(actor: ServerActor, id: string, input: unknown): Promise<T>;
}
export type WorkspaceResult = WorkspaceSnapshot & {
  patientVersions: Record<string, number>;
  doctorVersions: Record<string, number>;
  hospitalizationVersions: Record<string, number>;
  quoteVersions: Record<string, number>;
};

/** Server-only business operations. No SQL, collections, database handles or DELETE in HTTP/UI. */
export interface Persistence {
  nurseProfile?: {
    get(actor: ServerActor): Promise<NurseProfile>;
    save(actor: ServerActor, input: unknown): Promise<NurseProfile>;
  };
  onboarding?: {
    get(actor: ServerActor): Promise<WorkspaceSetup>;
    save(actor: ServerActor, input: unknown): Promise<WorkspaceSetup>;
  };
  auth: Pick<
    AuthService,
    'login' | 'register' | 'requireSession' | 'requireCsrf' | 'rotateCsrf' | 'logout'
  >;
  patients: EntityRepository<Patient, 'patient'>;
  doctors: EntityRepository<Doctor, 'doctor'>;
  hospitalizations: EntityRepository<Hospitalization, 'hospitalization'>;
  shifts: {
    list(actor: ServerActor): Promise<Shift[]>;
    listResources(actor: ServerActor): Promise<NursingResource[]>;
    createSeries(actor: ServerActor, input: unknown): Promise<Shift[]>;
  };
  operations: {
    list(actor: ServerActor): Promise<OperationsSnapshot>;
    execute(actor: ServerActor, input: unknown): Promise<unknown>;
  };
  files: {
    upload(actor: ServerActor, input: PrivateFileUpload): Promise<FileMetadata>;
    listForOwner(
      actor: ServerActor,
      ownerType: FileOwnerType,
      ownerId: string,
    ): Promise<FileMetadata[]>;
    download(
      actor: ServerActor,
      id: string,
    ): Promise<{ metadata: FileMetadata; bytes: Uint8Array } | null>;
  };
  workspace(actor: ServerActor): Promise<WorkspaceResult>;
  ready(): Promise<void>;
}
